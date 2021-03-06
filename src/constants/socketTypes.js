export const SOCKET_TYPES = {
	// online
	CONNECT: "connect",
	USER_ONLINE: "user-online",
	USER_OFFLINE: "user-offline",
	GET_ONLINE: "get-online",
	FORCE_LOGOUT: "force-logout",

	// room
	JOIN_ROOM_REQUEST: "join-room-request",
	JOIN_ROOM_SUCCESS: "join-room-success",
	HAS_NEW_ROOM: "has-new-room",
	REMOVE_OLD_ROOM: "remove-old-room",
	CREATE_ROOM_REQUEST: "create-room-request",
	FIND_MATCH: "join-room-quick",
	STOP_FIND_MATCH: "stop-join-room-quick",
	ROOM__SEND_CHAT: "room--send-chat",
	ROOM__RECEIVE_CHAT: "room--receive-chat",
	ROOM__JOIN_GAME_SUCCESS: "room--join-game-sucesss",
	ROOM_CREATE_ROOM_SUCCESS: "create-room-success",

	// game
	JOIN_ROOM_QUICK_SUCCESS: "join-room-quick-success",
	CHAT: "chat",
	MOVE: "move",
	DISCONNECT_ROOM: "disconnectRoom",
};
