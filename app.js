const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path')
const session = require('express-session');
require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const passport = require('passport');

require('./config/passport');


const app = express();

const server = http.createServer(app);
const io = new Server(server);

const connectDB = require('./config/db');
connectDB();


app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views'));

app.use(session({ secret: "skillswapsecret", resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require('./routes/adminRoutes');
const {requireSetup} = require('./middleware/requireSetup');
const {protect} = require('./middleware/authMiddleware');
const profileSetupRoute = require('./routes/profileSetupRoute');
const dashboardRoutes = require('./routes/dashboardRoute');
const profileRoutes = require('./routes/profileRoute');
const swapRouter = require('./routes/swapRouter');
const exploreRouter = require('./routes/userRouter');
const socketHandler = require('./socket/socketHandler');
const chatRoutes = require('./routes/chatRoute');
const sessionRoutes     = require('./routes/sessionRoutes');
const groupSessionRouter =require('./routes/groupsessionRoute');
const reviewRouter = require('./routes/reviewRoutes');
const { handleCashfreeWebhook } = require('./controllers/paymentController');
const paymentRoutes = require('./routes/paymentRoute');

socketHandler(io);
app.post('/payment/webhook', handleCashfreeWebhook);


app.use("/auth", authRoutes);

app.use('/admin', adminRoutes);

app.use('/profile-setup', profileSetupRoute);

app.use('/', dashboardRoutes);
app.use('/profile', profileRoutes);

app.get('/home', protect, requireSetup, (req, res) => res.redirect('/dashboard'));
app.use('/swaps', swapRouter);
app.use('/explore', exploreRouter);
app.use('/chats', chatRoutes);
app.use('/sessions',      sessionRoutes);
app.use('/group-sessions', groupSessionRouter)
app.use('/reviews', reviewRouter)
app.use('/payment', paymentRoutes);

const PORT = process.env.PORT || 5005;
server.listen(PORT , ()=>{
    console.log(`Server Running on ${PORT}`);
});