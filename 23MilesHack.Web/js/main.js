
(function (window, $, undefined) {


    window.URL = window.URL || window.webkitURL;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia || navigator.msGetUserMedia;

    navigator.getUserMedia({ video: true, audio: true }, function(stream) {
        var video = $("#my-webcam")[0];

        video.src = window.URL.createObjectURL(stream);
    }, function(e) {
        console.log(e);
    });


})(window, $);


