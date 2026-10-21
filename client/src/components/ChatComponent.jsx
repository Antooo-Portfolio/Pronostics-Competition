import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';

// Styles "en dur" pour être sûr qu'ils passent
const S = {
  chatBtn: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
    color: '#070b1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(255, 215, 0, 0.3)',
    zIndex: 1000,
    border: 'none',
    transition: 'transform 0.2s',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    background: '#ff3333',
    color: 'white',
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    fontSize: '12px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  chatWindow: {
    position: 'fixed',
    bottom: '90px',
    right: '24px',
    width: '350px',
    height: '500px',
    maxHeight: 'calc(100vh - 120px)',
    background: '#0e1427',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '16px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    overflow: 'hidden',
  },
  header: {
    padding: '16px',
    background: 'rgba(7, 11, 26, 0.95)',
    borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFD700',
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#8b9bb4',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '4px',
  },
  messagesArea: {
    flex: 1,
    padding: '16px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  messageRow: {
    display: 'flex',
    flexDirection: 'column',
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  messageAvatar: {
    fontSize: '16px',
  },
  messageAuthor: {
    fontSize: '12px',
    fontWeight: 600,
  },
  messageTime: {
    fontSize: '10px',
    color: '#8b9bb4',
  },
  messageBubble: {
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.4',
    wordBreak: 'break-word',
    maxWidth: '85%',
  },
  inputArea: {
    padding: '16px',
    borderTop: '1px solid rgba(255, 215, 0, 0.2)',
    background: 'rgba(7, 11, 26, 0.95)',
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    padding: '10px 16px',
    color: 'white',
    fontSize: '16px',
    outline: 'none',
  },
  sendBtn: {
    background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#070b1a',
  }
};

const AVAILABLE_EMOJIS = ['👍', '❤️', '😂', '😮', '😢'];

export default function ChatComponent({ user, socket }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [reactionUsersModal, setReactionUsersModal] = useState(null);
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

  const messagesEndRef = useRef(null);

  const handleReactionPointerDown = (mId, emoji, users) => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setReactionUsersModal({ messageId: mId, emoji, users });
    }, 400);
  };

  const handleReactionPointerUpOrLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
    }
  };

  const handleReactionClick = (mId, emoji) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    handleReact(mId, emoji);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Initial load
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const data = await api.getChatMessages();
        setMessages(data.messages);
        setUnreadCount(data.unreadCount);
        setLoading(false);
      } catch (e) {
        console.error("Erreur de chargement du chat :", e);
      }
    };
    fetchInitialData();
  }, []);

  // Listen to new messages
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      setMessages(prev => [...prev, msg]);
      
      // If window is open, mark as read immediately
      if (isOpen) {
        api.markChatAsRead(msg.id).catch(e => console.error(e));
      } else {
        // If it's not my own message, increment unread count
        if (msg.user_id !== user.id) {
          setUnreadCount(prev => prev + 1);
        }
      }
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    };

    socket.on('new_chat_message', handleNewMessage);
    socket.on('chat_reaction_updated', handleReactionUpdated);

    return () => {
      socket.off('new_chat_message', handleNewMessage);
      socket.off('chat_reaction_updated', handleReactionUpdated);
    };
  }, [socket, isOpen, user.id]);

  const handleReact = async (messageId, emoji) => {
    try {
      await api.reactToChatMessage(messageId, emoji);
      setActiveReactionMsgId(null);
    } catch(e) {
      console.error("Erreur reaction:", e);
    }
  };

  // Handle opening the chat
  const handleToggleChat = async () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    if (newIsOpen && unreadCount > 0 && messages.length > 0) {
      try {
        const lastMsg = messages[messages.length - 1];
        await api.markChatAsRead(lastMsg.id);
        setUnreadCount(0);
      } catch (e) {
        console.error("Erreur marquage lu :", e);
      }
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const content = newMessage.trim();
    setNewMessage(''); // Clear input optimistically

    try {
      await api.sendChatMessage(content);
    } catch (e) {
      console.error("Erreur envoi message :", e);
      alert("Erreur lors de l'envoi du message.");
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button 
        style={{
          ...S.chatBtn,
          transform: isOpen ? 'scale(0.9)' : 'scale(1)'
        }}
        onClick={handleToggleChat}
      >
        💬
        {unreadCount > 0 && !isOpen && (
          <div style={S.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </button>

      {/* Overlay invisible pour fermer le chat en cliquant à l'extérieur */}
      {isOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
          onClick={() => {
            setIsOpen(false);
            setReactionUsersModal(null);
          }}
        />
      )}

      {/* Chat Window */}
      {isOpen && (
        <div style={S.chatWindow} className="fadeIn chat-window-responsive">
          <div style={S.header}>
            <h3 style={S.title}>💬 Chat Global</h3>
            <button style={S.closeBtn} onClick={() => setIsOpen(false)}>×</button>
          </div>

          <div style={S.messagesArea}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#8b9bb4', marginTop: '20px' }}>Chargement...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8b9bb4', marginTop: '20px' }}>Aucun message. Soyez le premier à écrire !</div>
            ) : (
              messages.map((m, i) => {
                const isMe = m.user_id === user.id;
                const authorName = (m.username && m.username !== 'NULL' && m.username.trim() !== '') ? m.username : m.login;
                const timeStr = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={m.id || i} style={{ ...S.messageRow, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && (
                      <div style={S.messageHeader}>
                        <span style={{ ...S.messageAuthor, color: isMe ? '#FFD700' : '#8b9bb4' }}>{authorName}</span>
                        <span style={S.messageTime}>{timeStr}</span>
                      </div>
                    )}
                    
                    <div style={{
                      ...S.messageBubble,
                      background: isMe ? 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)' : 'rgba(255, 255, 255, 0.05)',
                      color: isMe ? '#070b1a' : '#e2e8f0',
                      border: isMe ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      borderBottomRightRadius: isMe ? '4px' : '12px',
                      borderBottomLeftRadius: !isMe ? '4px' : '12px',
                    }}>
                      {m.content}
                    </div>

                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap', justifyContent: isMe ? 'flex-end' : 'flex-start', width: '100%' }}>
                      {Object.entries(m.reactions || {}).map(([emoji, reactingUsers]) => {
                        if (!reactingUsers || reactingUsers.length === 0) return null;
                        const hasReacted = reactingUsers.some(u => u.id === user.id);
                        return (
                          <div key={emoji} style={{ position: 'relative' }}>
                            <div 
                              onClick={() => handleReactionClick(m.id, emoji)}
                              onPointerDown={() => handleReactionPointerDown(m.id, emoji, reactingUsers)}
                              onPointerUp={handleReactionPointerUpOrLeave}
                              onPointerLeave={handleReactionPointerUpOrLeave}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setReactionUsersModal({ messageId: m.id, emoji, users: reactingUsers });
                                isLongPress.current = true;
                              }}
                              style={{
                                background: hasReacted ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                border: `1px solid ${hasReacted ? '#FFD700' : 'transparent'}`,
                                borderRadius: '12px',
                                padding: '2px 6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                userSelect: 'none',
                                WebkitUserSelect: 'none'
                              }}
                            >
                              <span>{emoji}</span>
                              <span style={{ color: '#fff', fontSize: '10px' }}>{reactingUsers.length}</span>
                            </div>

                            {/* Modal des utilisateurs ayant réagi */}
                            {reactionUsersModal && reactionUsersModal.messageId === m.id && reactionUsersModal.emoji === emoji && (
                              <>
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setReactionUsersModal(null);
                                  }}
                                  onContextMenu={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setReactionUsersModal(null);
                                  }}
                                  style={{
                                    position: 'fixed',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    zIndex: 19
                                  }}
                                />
                                <div style={{
                                  position: 'absolute',
                                  bottom: '100%',
                                  left: isMe ? 'auto' : 0,
                                  right: isMe ? 0 : 'auto',
                                  marginBottom: '4px',
                                  background: '#0e1427',
                                  border: '1px solid rgba(255, 215, 0, 0.2)',
                                  borderRadius: '8px',
                                  padding: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                                  zIndex: 20,
                                  minWidth: '100px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '4px'
                                }}>
                                  <div style={{ fontSize: '11px', color: '#FFD700', borderBottom: '1px solid rgba(255,215,0,0.2)', paddingBottom: '4px', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold' }}>Réactions {emoji}</span>
                                    <button onClick={(e) => { e.stopPropagation(); setReactionUsersModal(null); }} style={{ background:'none', border:'none', color:'#8b9bb4', cursor:'pointer', padding: '0 4px' }}>×</button>
                                  </div>
                                  {reactionUsersModal.users.map(u => (
                                    <div key={u.id} style={{ fontSize: '13px', color: '#fff', whiteSpace: 'nowrap' }}>{u.name}</div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                      
                      <div style={{ position: 'relative' }}>
                        <div 
                          onClick={() => setActiveReactionMsgId(activeReactionMsgId === m.id ? null : m.id)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '12px',
                            padding: '2px 6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            color: '#8b9bb4',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          +
                        </div>
                        {activeReactionMsgId === m.id && (
                          <div style={{
                            position: 'absolute',
                            bottom: '100%',
                            [isMe ? 'right' : 'left']: 0,
                            marginBottom: '4px',
                            background: '#0e1427',
                            border: '1px solid rgba(255, 215, 0, 0.2)',
                            borderRadius: '20px',
                            padding: '4px 8px',
                            display: 'flex',
                            gap: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            zIndex: 10
                          }}>
                            {AVAILABLE_EMOJIS.map(emoji => (
                              <span 
                                key={emoji} 
                                style={{ cursor: 'pointer', fontSize: '16px', transition: 'transform 0.1s' }}
                                onClick={() => handleReact(m.id, emoji)}
                                onMouseOver={e => e.target.style.transform = 'scale(1.2)'}
                                onMouseOut={e => e.target.style.transform = 'scale(1)'}
                              >
                                {emoji}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {isMe && (
                      <div style={{ ...S.messageTime, marginTop: '4px' }}>{timeStr}</div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form style={S.inputArea} onSubmit={handleSendMessage}>
            <input 
              type="text" 
              style={S.input} 
              placeholder="Écrivez un message..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button type="submit" style={S.sendBtn} disabled={!newMessage.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}
