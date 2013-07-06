var WebRtc = WebRtc || {};

// todo:
//  cleanup: proper module loading
//  cleanup: promises to clear up some of the async chaining
//  feature: multiple chat partners

WebRtc.App = (function (viewModel, connectionManager) {
    var _mediaStream,
        _hub,
        
        _connect = function(username, onSuccess, onFailure) {
            // Set Up SignalR Signaler
            var hub = $.connection.webRtcHub;
            $.support.cors = true;
            $.connection.hub.url = '/signalr/hubs';
            $.connection.hub.start()
                .done(function () {
                    console.log('connected to SignalR hub... connection id: ' + _hub.connection.id);

                    // Tell the hub what our username is
                    hub.server.join(username);
                    
                    if (onSuccess) {
                        onSuccess(hub);
                    }
                })
                .fail(function (event) {
                    if (onFailure) {
                        onFailure(event);
                    }
                });

            // Setup client SignalR operations
            _setupHubCallbacks(hub);
            _hub = hub;
        },

        _start = function (hub) {
            // Show warning if WebRTC support is not detected
            if (webrtcDetectedBrowser == null) {
                console.log('Your browser doesnt appear to support WebRTC.');
                $('.browser-warning').show();
            }

            // Then proceed to the next step, gathering username
            _getUsername();
        },
        
        _getUsername = function() {
            alertify.prompt("What is your name?", function (e, username) {
                if (e == false || username == '') {
                    username = 'User ' + Math.floor((Math.random() * 10000) + 1);
                    alertify.success('You really need a username, so we will call you... ' + username);
                }

                // proceed to next step, get media access and start up our connection
                _startSession(username);
            }, '');
        },

        _startSession = function (username) {
            viewModel.Username(username); // Set the selected username in the UI
            viewModel.Loading(true); // Turn on the loading indicator

            // Ask the user for permissions to access the webcam and mic
            getUserMedia(
                {
                    // Permissions to request
                    video: true
                },
                function (stream) { // succcess callback gives us a media stream
                    $('.instructions').hide();
                    
                    // Now we have everything we need for interaction, so fire up SignalR
                    _connect(username, function (hub) {                        
                        // tell the viewmodel our conn id, so we can be treated like the special person we are.
                        viewModel.MyConnectionId(hub.connection.id);
                        
                        // Initialize our client signal manager, giving it a signaler (the SignalR hub) and some callbacks
                        console.log('initializing connection manager');
                        connectionManager.initialize(hub.server, _callbacks.onReadyForStream, _callbacks.onStreamAdded, _callbacks.onStreamRemoved);
                        
                        // Store off the stream reference so we can share it later
                        _mediaStream = stream;

                        // Load the stream into a video element so it starts playing in the UI
                        console.log('playing my local video feed');
                        var videoElement = document.querySelector('.video.mine');
                        attachMediaStream(videoElement, _mediaStream);

                        // Hook up the UI
                        _attachUiHandlers();
                        
                        viewModel.Loading(false);
                    }, function(event) {
                        alertify.alert('<h4>Failed SignalR Connection</h4> We were not able to connect you to the signaling server.<br/><br/>Error: ' + JSON.stringify(event));
                        viewModel.Loading(false);
                    });  
                },
                function (error) { // error callback
                    alertify.alert('<h4>Failed to get hardware access!</h4> Do you have another browser type open and using your cam/mic?<br/><br/>You were not connected to the server, because I didn\'t code to make browsers without media access work well. <br/><br/>Actual Error: ' + JSON.stringify(error));
                    viewModel.Loading(false);
                }
            );
        },
        
        _attachUiHandlers = function () {
            viewModel.injectHub(_hub);
            viewModel.injectConnectionManager(connectionManager);
        },
        
        _setupHubCallbacks = function (hub) {
            
            // Hub Callback: Call Accepted
            hub.client.callAccepted = function (acceptingUser) {
                console.log('call accepted from: ' + JSON.stringify(acceptingUser) + '.  Initiating WebRTC call and offering my stream up...');

                // Callee accepted our call, let's send them an offer with our video stream
                connectionManager.initiateOffer(acceptingUser.ConnectionId, _mediaStream);
                
                // Set UI into call mode
                viewModel.Mode('incall');
            };

            // Hub Callback: Call Ended
            hub.client.callEnded = function (user, reason) {
                console.log('call with ' + user.ConnectionId + ' has ended: ' + reason);

                // Let the user know why the server says the call is over
                alertify.error(reason);

                // Close the WebRTC connection
                connectionManager.closeConnection(user.ConnectionId);

                // Set the UI back into idle mode
                viewModel.Mode('idle');
            };

            // Hub Callback: Update User List
            hub.client.updateUserList = function (userList) {
                viewModel.setUsers(userList);
            };

            // Hub Callback: WebRTC Signal Received
            hub.client.receiveSignal = function (callingUser, data) {
                connectionManager.newSignal(callingUser.ConnectionId, data);
            };
        },
        // Connection Manager Callbacks
        _callbacks = {
            onReadyForStream: function (connection) {
                // The connection manager needs our stream
                // todo: not sure I like this
                connection.addStream(_mediaStream);
            },
            onStreamAdded: function (connection, event) {
                console.log(connection, event);
                console.log('binding remote stream to the partner window');

                connection.hackStreamId = event.stream.id;
                //todo: adding multiple connections 

                // Bind the remote stream to the partner window

                var parent = document.querySelector('#people');
                
                var x = document.createElement('div');
                x.className = 'span2 ' + event.stream.id;

                var otherVideo = document.createElement('video');
                otherVideo.setAttribute("autoplay", "autoplay");
                otherVideo.className = 'video partner cool-background';

                x.appendChild(otherVideo);
                parent.appendChild(x);

                var dispose = function(e) {
                    otherVideo.src = '';
                };
                
                otherVideo.addEventListener("error", dispose);
                
                attachMediaStream(otherVideo, event.stream); // from adapter.js
            },
            onStreamRemoved: function (connection, streamId) {
                // todo: proper stream removal.  right now we are only set up for one-on-one which is why this works.
                console.log('removing remote stream from partner window');
                
                // Clear out the partner window
                var otherVideo = document.querySelector('.' + connection.hackStreamId);
                $(otherVideo).remove();
            }
        };

    return {
        start: _start, // Starts the UI process
        getStream: function() { // Temp hack for the connection manager to reach back in here for a stream
            return _mediaStream;
        }
    };
})(WebRtc.ViewModel, WebRtc.ConnectionManager);

// Kick off the app
WebRtc.App.start();