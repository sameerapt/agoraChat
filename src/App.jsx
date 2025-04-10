import { useEffect, useState, useRef } from "react";
import AgoraChat from "agora-chat";

function App() {
  // Replace these with your actual Agora credentials
  const appKey = "411326737#1528760"; // Your Agora App Key
  const [userId, setUserId] = useState("test"); // Your user ID
  const [token, setToken] = useState(
    "007eJxTYOhS9bD5eH3Jmg2iDv90b67aGWC/zZfl3IWdSwQ0CidEnkpTYDBPMTc2STWyNE42SzWxMLC0TEkySTNIMko1MrMwtzRKOST2Pb0hkJFh7YQVrIwMrAyMQAjiqzAkmRhZJJsnGegamliY6RoaphnoJhkkW+iamCeamhuYGCabJVkAAKv5J4o="
  ); // Your token
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [groupMessages, setGroupMessages] = useState({});
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState([]);
  const chatClient = useRef(null);

  // Group creation states
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);
  const [createGroupName, setCreateGroupName] = useState("");
  const [createGroupDescription, setCreateGroupDescription] = useState("");
  const [createGroupMembersInput, setCreateGroupMembersInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [allowInvites, setAllowInvites] = useState(true);
  const [inviteNeedConfirm, setInviteNeedConfirm] = useState(true);
  const [maxUsers, setMaxUsers] = useState(500);

  // Group joining states
  const [showJoinGroupForm, setShowJoinGroupForm] = useState(false);
  const [groupIdToJoin, setGroupIdToJoin] = useState("");
  const [joinMessage, setJoinMessage] = useState("");

  // Group leaving states
  const [showLeaveGroupForm, setShowLeaveGroupForm] = useState(false);
  const [groupIdToLeave, setGroupIdToLeave] = useState("");

  // Add log entry for debugging
  const addLog = (log) => {
    setLogs((prevLogs) => [...prevLogs, log]);
  };

  // Login to Agora Chat
  const handleLogin = () => {
    if (userId && token) {
      chatClient.current.open({
        user: userId,
        accessToken: token,
      });
    } else {
      addLog("Please enter userId and token");
    }
  };

  // Logout from Agora Chat
  const handleLogout = () => {
    chatClient.current.close();
    setIsLoggedIn(false);
    setUserId("");
    setToken("");
    setCurrentGroupId(null);
  };

  // Create a new group
  const handleCreateGroup = async () => {
    if (!createGroupName.trim()) {
      addLog("Group name is required");
      return;
    }
    try {
      const members = createGroupMembersInput.split(",").map((m) => m.trim());
      const options = {
        data: {
          groupname: createGroupName,
          desc: createGroupDescription,
          members,
          public: isPublic,
          approval: approvalRequired,
          allowinvites: allowInvites,
          inviteNeedConfirm,
          maxusers: parseInt(maxUsers, 10),
        },
      };
      const res = await chatClient.current.createGroup(options);
      addLog(`Group created: ${res.data.groupid}`);
      setShowCreateGroupForm(false);
    } catch (error) {
      addLog(`Create group failed: ${error.message}`);
    }
  };

  // Check group membership and redirect to conversation if already a member
  const checkGroupMembership = async (groupId) => {
    try {
      const res = await chatClient.current.groupManager.fetchGroupMembers({
        groupId: groupId,
        pageSize: 200, // Adjust based on expected group size
      });
      const members = res.data;
      const isMember = members.some((member) => member === userId);
      if (isMember) {
        setCurrentGroupId(groupId);
        loadGroupMessages(groupId);
        addLog(`Already in group ${groupId}. Redirecting to chat.`);
        return true;
      } else {
        addLog(`You are not a member of group ${groupId}.`);
        return false;
      }
    } catch (error) {
      addLog(`Failed to check group membership: ${error.message}`);
      return false;
    }
  };

  // Join an existing group or redirect to conversation if already a member
  const handleJoinGroup = async () => {
    if (!groupIdToJoin.trim()) {
      addLog("Group ID is required");
      return;
    }
    // Check if user is already a member
    const isMember = await checkGroupMembership(groupIdToJoin);
    if (isMember) {
      setShowJoinGroupForm(false);
      return;
    }
    // If not a member, attempt to join
    try {
      const options = {
        groupId: groupIdToJoin,
        message: joinMessage,
      };
      await chatClient.current.joinGroup(options);
      addLog(`Joined group: ${groupIdToJoin} successfully.`);
      setShowJoinGroupForm(false);
      // After joining, set current group ID and load messages
      setCurrentGroupId(groupIdToJoin);
      loadGroupMessages(groupIdToJoin);
    } catch (error) {
      setCurrentGroupId(groupIdToJoin);
      // Handle case where user is already in group but join fails
      if (
        error.error === "forbidden_op" &&
        error.error_description.includes("already in group")
      ) {
        loadGroupMessages(groupIdToJoin);
        addLog(`You are already in group ${groupIdToJoin}. Redirecting to chat.`);
      } else {
        addLog(`Join group failed: ${error.message}`);
      }
      setShowJoinGroupForm(false);
    }
  };
  console.log('currentGroupId', currentGroupId);
  // Leave a group
  const handleLeaveGroup = async () => {
    if (!groupIdToLeave.trim()) {
      addLog("Group ID is required");
      return;
    }
    try {
      const options = { groupId: groupIdToLeave };
      await chatClient.current.leaveGroup(options);
      addLog(`Left group: ${groupIdToLeave}`);
      setShowLeaveGroupForm(false);
      if (currentGroupId === groupIdToLeave) {
        setCurrentGroupId(null);
      }
    } catch (error) {
      addLog(`Leave group failed: ${error.message}`);
    }
  };

  // List public groups
  const handleListPublicGroups = async () => {
    try {
      const options = { limit: 20, cursor: null };
      const res = await chatClient.current.getPublicGroups(options);
      addLog(`Public groups: ${JSON.stringify(res.data)}`);
    } catch (error) {
      addLog(`List public groups failed: ${error.message}`);
    }
  };

  // Load group message history
  const loadGroupMessages = async (groupId) => {
    try {
      const res = await chatClient.current.getHistoryMessages({
        targetId: groupId,
        chatType: "groupChat",
        pageSize: 20,
      });
      setGroupMessages((prev) => ({ ...prev, [groupId]: res.messages || [] }));
    } catch (error) {
      addLog(`Failed to load group messages: ${error.message}`);
    }
  };

  // Send a message to the current group
  const handleSendMessage = async () => {
    if (!currentGroupId) {
      addLog("Please select a group to chat in");
      return;
    }
    if (message.trim()) {
      try {
        const options = {
          chatType: "groupChat",
          type: "txt",
          to: currentGroupId,
          msg: message,
        };
        let msg = AgoraChat.message.create(options);
        await chatClient.current.send(msg);
        // Create local message object for display
        const localMsg = {
          from: userId,
          to: currentGroupId,
          msg: message,
          type: "txt",
          timestamp: Date.now(),
        };
        setGroupMessages((prev) => ({
          ...prev,
          [currentGroupId]: [...(prev[currentGroupId] || []), localMsg],
        }));
        setMessage("");
      } catch (error) {
        addLog(`Message send failed: ${error.message}`);
      }
    } else {
      addLog("Please enter message content");
    }
  };
  // Initialize Agora Chat client and event handlers
  useEffect(() => {
    chatClient.current = new AgoraChat.connection({
      appKey: appKey,
    });

    chatClient.current.addEventHandler("connection&message", {
      onConnected: () => {
        setIsLoggedIn(true);
        addLog(`User ${userId} Connect success!`);
      },
      onDisconnected: () => {
        setIsLoggedIn(false);
        addLog(`User Logout!`);
      },
      onTextMessage: (message) => {
        if (message.chatType === "groupChat") {
          setGroupMessages((prev) => ({
            ...prev,
            [message.to]: [...(prev[message.to] || []), message],
          }));
        }
      },
      onTokenWillExpire: () => {
        addLog("Token is about to expire");
      },
      onTokenExpired: () => {
        addLog("Token has expired");
      },
      onError: (error) => {
        addLog(`on error: ${error.message}`);
      },
    });

    return () => {
      chatClient.current.removeEventHandler("connection&message");
    };
  }, []);
  useEffect(() => {
    loadGroupMessages(currentGroupId);
  }, [currentGroupId]);
  return (
    <div
      style={{
        width: "500px",
        display: "flex",
        gap: "10px",
        flexDirection: "column",
      }}
    >
      <h2>Agora Chat Examples</h2>
      {!isLoggedIn ? (
        <>
          <div>
            <label>UserID: </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter the user ID"
            />
          </div>
          <div>
            <label>Token: </label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Enter the token"
            />
          </div>
          <button onClick={handleLogin}>Login</button>
        </>
      ) : (
        <>
          <h3>Welcome, {userId}</h3>
          <button onClick={handleLogout}>Logout</button>

          {/* Group Operations */}
          <h3>Group Operations</h3>
          <button onClick={() => setShowCreateGroupForm(true)}>
            Create Group
          </button>
          <button onClick={() => setShowJoinGroupForm(true)}>Join Group</button>
          <button onClick={() => setShowLeaveGroupForm(true)}>
            Leave Group
          </button>
          <button onClick={handleListPublicGroups}>List Public Groups</button>

          {/* Create Group Form */}
          {showCreateGroupForm && (
            <div
              style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}
            >
              <h4>Create Group</h4>
              <label>Group Name:</label>
              <input
                type="text"
                value={createGroupName}
                onChange={(e) => setCreateGroupName(e.target.value)}
                placeholder="Enter group name"
              />
              <label>Description:</label>
              <input
                type="text"
                value={createGroupDescription}
                onChange={(e) => setCreateGroupDescription(e.target.value)}
                placeholder="Enter group description"
              />
              <label>Members (comma-separated):</label>
              <input
                type="text"
                value={createGroupMembersInput}
                onChange={(e) => setCreateGroupMembersInput(e.target.value)}
                placeholder="Enter members"
              />
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                Public Group
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={approvalRequired}
                  onChange={(e) => setApprovalRequired(e.target.checked)}
                />
                Approval Required
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={allowInvites}
                  onChange={(e) => setAllowInvites(e.target.checked)}
                />
                Allow Invites
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={inviteNeedConfirm}
                  onChange={(e) => setInviteNeedConfirm(e.target.checked)}
                />
                Invite Needs Confirmation
              </label>
              <label>Max Users:</label>
              <input
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                placeholder="Max users"
              />
              <button onClick={handleCreateGroup}>Create</button>
              <button onClick={() => setShowCreateGroupForm(false)}>Cancel</button>
            </div>
          )}

          {/* Join Group Form */}
          {showJoinGroupForm && (
            <div
              style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}
            >
              <h4>Join Group</h4>
              <label>Group ID:</label>
              <input
                type="text"
                value={groupIdToJoin}
                onChange={(e) => setGroupIdToJoin(e.target.value)}
                placeholder="Enter group ID"
              />
              <label>Join Message:</label>
              <input
                type="text"
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="Optional join message"
              />
              <button onClick={handleJoinGroup}>Join</button>
              <button onClick={() => setShowJoinGroupForm(false)}>Cancel</button>
            </div>
          )}

          {/* Leave Group Form */}
          {showLeaveGroupForm && (
            <div
              style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}
            >
              <h4>Leave Group</h4>
              <label>Group ID:</label>
              <input
                type="text"
                value={groupIdToLeave}
                onChange={(e) => setGroupIdToLeave(e.target.value)}
                placeholder="Enter group ID"
              />
              <button onClick={handleLeaveGroup}>Leave</button>
              <button onClick={() => setShowLeaveGroupForm(false)}>Cancel</button>
            </div>
          )}

          {/* Group Chat Interface */}
          {currentGroupId && (
            <div
              style={{ border: "1px solid #ccc", padding: "10px", marginTop: "10px" }}
            >
              <h4>Group Chat: {currentGroupId}</h4>
              <div
                style={{
                  height: "200px",
                  overflowY: "scroll",
                  border: "1px solid #ddd",
                  padding: "5px",
                }}
              >
                <div
                  style={{
                    height: "200px",
                    overflowY: "scroll",
                    border: "1px solid #ddd",
                    padding: "5px",
                  }}
                >
                  {(groupMessages[currentGroupId] || []).map((msg, index) => (
                    <div key={index}>
                      <strong>{msg.from}:</strong> {msg.msg}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type a message"
                />
                <button onClick={handleSendMessage}>Send</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Operation Logs */}
      <h3>Operation Log</h3>
      <div
        style={{
          height: "300px",
          overflowY: "auto",
          border: "1px solid #ccc",
          padding: "10px",
          textAlign: "left",
        }}
      >
        {logs.map((log, index) => (
          <div key={index}>{log}</div>
        ))}
      </div>
    </div>
  );
}

export default App;