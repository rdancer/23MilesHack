namespace _23MilesHack.Web.Hubs
{
	using System.Collections.Generic;
	using System.Linq;

	using Microsoft.AspNet.SignalR;

	using _23MilesHack.Web.Models;

	public class WebRtcHub : Hub
	{
		private static readonly List<User> Users = new List<User>();


		public void Join(string username)
		{
			var me = new User { Username = username, ConnectionId = Context.ConnectionId };
			// Add the new user
			Users.Add(me);

			this.updateList();

			CallOthers(me);
		}

		private void CallOthers(User me)
		{
			Clients.Others.callAccepted(me);
		}

		private void updateList()
		{
			Clients.All.updateUserList(Users);
		}

		public override System.Threading.Tasks.Task OnDisconnected()
		{
			// Hang up any calls the user is in
			HangUp(); // Gets the user from "Context" which is available in the whole hub

			// Remove the user
			Users.RemoveAll(u => u.ConnectionId == Context.ConnectionId);

			// Send down the new user list to all clients
			this.updateList();

			return base.OnDisconnected();
		}
		
		public void HangUp()
		{
			var callingUser = Users.SingleOrDefault(u => u.ConnectionId == Context.ConnectionId);

			if (callingUser == null)
			{
				return;
			}

			Users.Remove(callingUser);

			Clients.All.callEnded(callingUser, "disconnected");

			this.updateList();
		}

		// WebRTC Signal Handler
		public void SendSignal(string signal, string targetConnectionId)
		{
			var callingUser = Users.SingleOrDefault(u => u.ConnectionId == Context.ConnectionId);
			var targetUser = Users.SingleOrDefault(u => u.ConnectionId == targetConnectionId);

			// Make sure both users are valid
			if (callingUser == null || targetUser == null)
			{
				return;
			}

			Clients.Client(targetConnectionId).receiveSignal(callingUser, signal);
		}

	}
}