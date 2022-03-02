if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}
const sendMail = require('./public/javascripts/mail')
const express = require('express');
const Campground = require('./models/campground');
const path = require('path');
const mongoose = require('mongoose');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const ExpressError = require('./utils/ExpressError');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const MongoStore = require('connect-mongo')
const swal = require('sweetalert')
const db_url='mongodb://localhost:27017/Campgrounds'
const mongoSanitize = require('express-mongo-sanitize');
const userRoutes = require('./routes/users');
const campgroundRoutes = require('./routes/campgrounds');
const reviewRoutes = require('./routes/reviews');
mongoose.connect(db_url, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected");
});
const secret = process.env.SECRET||'thisisasecret'
const app = express();

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')))
app.use(mongoSanitize({
    replaceWith: '_'
}))
app.use(express.static(path.join(__dirname,'public')) )
const store=new  MongoStore({
    mongoUrl:db_url,
    secret,
    ttl:24*60*60
})
store.on('error',(e)=>{
    console.log("Session store error")
})
const sessionConfig = {
    store,
    name: "Tripper",
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        // secure: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}

app.use(session(sessionConfig));
app.use(flash());


app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})


app.use('/', userRoutes);
app.use('/spots', campgroundRoutes)
app.use('/spots/:id/reviews', reviewRoutes)

app.get('/', (req, res) => {
    res.render('home')
});

app.get('/map',async(req,res)=>{
    const campgrounds = await Campground.find({}).populate('popupText');
    res.render('spots/map', { campgrounds })
})
app.get('/about',async(req,res)=>{
    const camp = await Campground.find({});
    const user = await User.find({});
    res.render('about.ejs',{camp,user})
})

app.post('/about', (req, res) => {
    const { email, feedback } = req.body;
    
    console.log('Data: ', req.body);

    sendMail(email,feedback, function(err, data) {
        if (err) {
            console.log('ERROR: ', err);
            return res.status(500).json({ message: err.message || 'Internal Error' });
        }
        req.flash("success","Email sent succesfullly")
        return res.redirect('/spots');
    });
});

app.all('*', (req, res, next) => {
    next(new ExpressError('Page Not Found', 404))
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) err.message = 'Oh No, Something Went Wrong!'
    res.status(statusCode).render('error', { err })
})

const port = process.env.PORT || 3000
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})


