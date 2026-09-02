import { useEffect, useRef, memo, useCallback, useMemo, useState } from "react";
import { useUserChatStore } from "../store/userChatStore";
import MessageInput from "./MessageInput";
import ChatHeader from "./ChatHeader";
import MessageSkeleton from "./Skeletons/MessageSkeleton";
import { useUserAuthStore } from "../store/userAuthStore";
import { useUserAppearanceStore } from "../store/userAppearanceStore";
import { BACKGROUND_OPTIONS, BUBBLE_STYLES, FONT_SIZES, DENSITY_OPTIONS } from "../constants/appearanceSection.js";
import { formatMessageTime } from "../lib/utils";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import MediaModal from "../models/MediaModel.jsx";
import FileAttachment from "./ChatContainerFeaturesExtensions/FileAttachment.jsx";
import MessageModal from "./../models/MessageModal";

// Message Item Component
const MessageItem = memo(
    ({ message, user, selectedUser, isLast, messageRef, appearance, onMediaClick, onMessageClick }) => {
        const isOwnMessage = message.senderId === user._id;
        const senderInfo = isOwnMessage ? user : selectedUser;
        const { bubbleStyle, showTimestamps, showAvatars, fontSize } = appearance;

        const bubbleClassName = BUBBLE_STYLES.find((style) => style.id === bubbleStyle)?.class || "rounded-2xl";
        const fontSizeClassName = FONT_SIZES.find((size) => size.id === fontSize)?.class || "text-base";

        // Check for any type of file attachment
        const fileUrl = message.image || message.video || message.audio || message.file;
        const hasFileAttachment = Boolean(fileUrl);
        const hasTextContent = Boolean(message.text?.trim());

        // Emoji detector - check if message is only emojis
        const isEmojiOnly = useMemo(() => {
            if (!message.text?.trim()) return false;
            // Remove all emojis and see if anything is left
            const textWithoutEmojis = message.text
                .replace(
                    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
                    ""
                )
                .trim();
            return textWithoutEmojis.length === 0 && message.text.length > 0;
        }, [message.text]);

        return (
            <div
                className={`chat ${isOwnMessage ? "chat-end" : ""}`}
                ref={isLast ? messageRef : null}
                onClick={() => onMessageClick(message)}
            >
                {showAvatars && (
                    <div className="chat-image avatar">
                        <div className="size-10 rounded-full border overflow-hidden bg-gray-200">
                            <img
                                src={senderInfo?.profileImage}
                                alt={`${senderInfo?.name || "User"}'s profile`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.target.src = "/default-avatar.png"; // Fallback avatar
                                }}
                            />
                        </div>
                    </div>
                )}
                <div
                    className={`relative chat-bubble flex flex-col ${bubbleClassName} shadow-md ${
                        hasFileAttachment || hasTextContent ? "p-0 overflow-hidden" : "p-4"
                    } ${isOwnMessage ? "bg-[#bed2ef] text-gray-900" : "bg-[#ffeeab] text-black border"} ${
                        isEmojiOnly ? "bg-transparent !shadow-none" : ""
                    }`}
                    style={{ maxWidth: hasFileAttachment ? "320px" : "400px" }}
                >
                    {/* File attachment rendering */}
                    {hasFileAttachment && (
                        <div className={hasTextContent ? "mb-2" : ""}>
                            <FileAttachment file={fileUrl} onMediaClick={onMediaClick} />
                        </div>
                    )}

                    {/* Text content rendering */}
                    {hasTextContent && (
                        <div
                            className={`${isEmojiOnly ? "text-4xl p-2" : `px-4 py-3 ${fontSizeClassName}`} ${
                                hasFileAttachment ? "pt-0" : ""
                            }`}
                        >
                            <ReactMarkdown
                                components={{
                                    code({ node, inline, className, children, ...props }) {
                                        const match = /language-(\w+)/.exec(className || "");
                                        return !inline && match ? (
                                            <div className="my-2 rounded-md overflow-hidden">
                                                <SyntaxHighlighter
                                                    style={vscDarkPlus}
                                                    language={match[1]}
                                                    PreTag="div"
                                                    wrapLines={true}
                                                    customStyle={{
                                                        margin: 0,
                                                        borderRadius: "6px",
                                                        fontSize: "0.875rem",
                                                    }}
                                                    {...props}
                                                >
                                                    {String(children).replace(/\n$/, "")}
                                                </SyntaxHighlighter>
                                            </div>
                                        ) : (
                                            <code
                                                className={`${className} bg-black/10 px-1 py-0.5 rounded text-sm`}
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    },
                                    p({ children }) {
                                        return <p className="mb-1 last:mb-0">{children}</p>;
                                    },
                                    ul({ children }) {
                                        return <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>;
                                    },
                                    ol({ children }) {
                                        return <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>;
                                    },
                                }}
                            >
                                {message.text}
                            </ReactMarkdown>
                        </div>
                    )}

                    {/* Timestamp */}
                    {showTimestamps && (
                        <span className="text-[11px] text-slate-500 mt-1 mr-3 mb-2 self-end opacity-70 hover:opacity-100 transition-opacity duration-200">
                            {formatMessageTime(message.createdAt)}
                        </span>
                    )}
                    {message.reactions && message.reactions.length > 0 && (
                        <div className="absolute bottom-0 right-0 flex items-center space-x-1 p-1 bg-base-100 rounded-full shadow-md">
                            {message.reactions.map((reaction, index) => (
                                <span key={index} className="text-xs">
                                    {reaction.emoji}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }
);
MessageItem.displayName = "MessageItem";

const EmptyState = memo(() => (
    <div className="flex-1 flex items-center justify-center text-gray-500 p-8">
        <div className="text-center">
            <p className="text-lg font-medium mb-2">No messages yet</p>
            <p className="text-sm opacity-75">Start a conversation!</p>
            <p className="text-md opacity-75 mt-12 italic">Your messages are end to end encrypted</p>
        </div>
    </div>
));
EmptyState.displayName = "EmptyState";

const MessageListErrorBoundary = ({ children, fallback }) => {
    try {
        return children;
    } catch (error) {
        console.error("Error rendering messages:", error);
        return (
            fallback || (
                <div className="flex-1 flex items-center justify-center text-red-500 p-8">
                    <div className="text-center">
                        <p className="text-lg font-medium mb-2">Unable to load messages</p>
                        <p className="text-sm opacity-75">Please try refreshing the page</p>
                    </div>
                </div>
            )
        );
    }
};

const ChatContainer = memo(() => {
    const {
        message,
        getMessages,
        isMessageLoading,
        selectedUser,
        subscribeToMessages,
        unSubscribeToMessages,
        reactToMessage,
        deleteMessage,
    } = useUserChatStore();
    const [mediaInModal, setMediaInModal] = useState(null);
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const { user } = useUserAuthStore();
    const appearance = useUserAppearanceStore();
    const { chatBackground, density, animationsEnabled } = appearance;
    const messageEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    const background = BACKGROUND_OPTIONS.find((bg) => bg.id === chatBackground) || BACKGROUND_OPTIONS[0];
    const densitySettings = DENSITY_OPTIONS.find((d) => d.id === density) || DENSITY_OPTIONS[1];

    const handleMediaClick = useCallback((src, type) => {
        setMediaInModal({ src, type });
    }, []);

    const handleMessageClick = (message) => {
        setSelectedMessage(message);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedMessage(null);
    };

    // const handleStar = (messageId) => {
    //     starMessage(messageId);
    //     handleCloseModal();
    // };

    const handleDelete = (messageId) => {
        deleteMessage(messageId);
        handleCloseModal();
    };

    const handleReact = (messageId, emoji) => {
        reactToMessage(messageId, emoji);
        handleCloseModal();
    };

    const scrollToBottom = useCallback(() => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({
                behavior: animationsEnabled ? "smooth" : "auto",
                block: "end",
            });
        }
    }, [animationsEnabled]);

    const handleScroll = useCallback(async (e) => {
        const { scrollTop } = e.target;
        if (scrollTop === 0 && !isLoadingMore && message.length > 0) {
            setIsLoadingMore(true);
            const oldestMessage = message[0];
            
            // Save current scroll height to adjust later
            const container = messagesContainerRef.current;
            const previousScrollHeight = container ? container.scrollHeight : 0;
            
            await getMessages(selectedUser._id, oldestMessage.createdAt);
            
            // Adjust scroll position so it doesn't jump to the top of new messages
            if (container) {
                requestAnimationFrame(() => {
                    container.scrollTop = container.scrollHeight - previousScrollHeight;
                });
            }
            
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, message, getMessages, selectedUser?._id]);

    useEffect(() => {
        if (selectedUser?._id && getMessages) {
            getMessages(selectedUser._id);
            if (subscribeToMessages) {
                subscribeToMessages();
            }
        }
        return () => {
            if (unSubscribeToMessages) {
                unSubscribeToMessages();
            }
        };
    }, [selectedUser?._id, getMessages, subscribeToMessages, unSubscribeToMessages]);

    useEffect(() => {
        if (message && message.length > 0) {
            const timeoutId = setTimeout(scrollToBottom, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [message, scrollToBottom]);

    const memoizedMessages = useMemo(() => {
        if (!Array.isArray(message) || message.length === 0) {
            return [];
        }

        return message.map((msg, index) => (
            <MessageItem
                key={msg._id || `message-${index}`}
                message={msg}
                user={user}
                selectedUser={selectedUser}
                isLast={index === message.length - 1}
                messageRef={messageEndRef}
                appearance={appearance}
                onMediaClick={handleMediaClick}
                onMessageClick={handleMessageClick}
            />
        ));
    }, [message, user, selectedUser, appearance, handleMediaClick]);

    if (isMessageLoading) {
        return (
            <div className="flex-1 flex flex-col h-full">
                <div className="shrink-0">
                    <ChatHeader />
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <MessageSkeleton />
                </div>
                <div className="shrink-0">
                    <MessageInput />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-base-100">
            <div className="shrink-0 border-b border-base-300">
                <ChatHeader />
            </div>
            <div
                className={`flex-1 overflow-y-auto scroll-smooth ${background.value} ${densitySettings.spacing} ${densitySettings.padding}`}
                onScroll={handleScroll}
                style={
                    background.imageUrl
                        ? { backgroundImage: `url(${background.imageUrl})` }
                        : background.pattern
                        ? { backgroundImage: background.pattern, backgroundSize: background.patternSize || "20px 20px" }
                        : {}
                }
                ref={messagesContainerRef}
            >
                <MessageListErrorBoundary>
                    {memoizedMessages.length > 0 ? (
                        <>
                            {memoizedMessages}
                            <div ref={messageEndRef} className="h-0" />
                        </>
                    ) : (
                        <EmptyState />
                    )}
                </MessageListErrorBoundary>
            </div>
            <div className="shrink-0 border-t border-base-300">
                <MessageInput />
            </div>
            {mediaInModal && (
                <MediaModal src={mediaInModal.src} type={mediaInModal.type} onClose={() => setMediaInModal(null)} />
            )}
            {isModalOpen && selectedMessage && (
                <MessageModal
                    message={selectedMessage}
                    onClose={handleCloseModal}
                    onDelete={handleDelete}
                    onReact={handleReact}
                />
            )}
        </div>
    );
});

ChatContainer.displayName = "ChatContainer";
export default ChatContainer;
