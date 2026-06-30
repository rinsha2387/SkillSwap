const Chat = require('../models/chat');

module.exports = (io) => {

  io.on('connection', (socket) => {

    console.log('Socket connected:', socket.id);

  socket.on('joinRoom', ({ chatId, userId }) => {
      socket.join(chatId);
      console.log(`User ${userId} joined room ${chatId}`);
    });

  socket.on('sendMessage', async ({ chatId, senderId, content }) => {

      try {
        
        console.log({ chatId, senderId, content });

        if (!content || !content.trim()) return;

        const chat = await Chat.findById(chatId);

        if (!chat) {
          socket.emit('error', {
            message: 'Chat not found'
          });
          return;
        }

        const isParticipant = chat.participants.some(
          p => p.toString() === senderId
        );

        if (!isParticipant) {
          socket.emit('error', {
            message: 'Not authorized'
          });
          return;
        }

        const newMessage = {
          sender: senderId,
          content: content.trim(),
          readBy: [senderId]
        };

        chat.messages.push(newMessage);

        chat.lastMessage =
          content.trim().substring(0, 60);

        chat.lastMessageAt = new Date();

        await chat.save();

        const savedMsg =
          chat.messages[chat.messages.length - 1];

        io.to(chatId).emit('receiveMessage', {
          senderId,
          content: savedMsg.content,
          createdAt: savedMsg.createdAt
        });

      } catch (err) {

        console.error(err);

        socket.emit('error', {
          message: 'Failed to send message'
        });

      }

    });

  socket.on('typing', ({ chatId, userId, name }) => {
      socket.to(chatId).emit('userTyping', {
        userId,
        name
      });
    });

  socket.on('stopTyping', ({ chatId }) => {
      socket.to(chatId).emit('userStoppedTyping');
    });

  socket.on('disconnect', () => {
      console.log(' Socket disconnected:', socket.id);
    });

  });

};