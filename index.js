const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/posts_db';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_here';

// ----- موديل المنشور -----
const postSchema = new mongoose.Schema({
  name: { type: String, required: true },
  content: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

// ----- موديل المستخدم (المدير) -----
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' }
});

const User = mongoose.model('User', userSchema);

// ----- Middleware للتحقق من صلاحية المدير -----
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.startsWith('Bearer ')){
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    if(decoded.role !== 'admin'){
      return res.status(403).json({ message: 'Forbidden: Requires admin role' });
    }
    next();
  } catch(err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- روت لتسجيل دخول المدير (ببساطة) ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if(!username || !password){
    return res.status(400).json({ message: 'Username and password required' });
  }

  const user = await User.findOne({ username });
  if(!user){
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if(!valid){
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// --- روت لإنشاء منشور جديد ---
app.post('/api/posts', async (req, res) => {
  try {
    const { name, content, imageUrl } = req.body;
    if(!name || !content){
      return res.status(400).json({ message: 'الاسم والنص مطلوبان' });
    }
    const newPost = new Post({ name, content, imageUrl });
    await newPost.save();
    res.status(201).json(newPost);
  } catch(err) {
    res.status(500).json({ message: 'حدث خطأ في السيرفر' });
  }
});

// --- روت لجلب كل المنشورات ---
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch(err) {
    res.status(500).json({ message: 'حدث خطأ في السيرفر' });
  }
});

// --- روت حذف منشور (محمي للمدير فقط) ---
app.delete('/api/posts/:id', authMiddleware, async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);
    if(!post){
      return res.status(404).json({ message: 'المنشور غير موجود' });
    }
    await Post.deleteOne({ _id: postId });
    res.json({ message: 'تم حذف المنشور بنجاح' });
  } catch(err) {
    res.status(500).json({ message: 'حدث خطأ في السيرفر' });
  }
});

// --- اتصال بقاعدة البيانات وتشغيل السيرفر ---
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected');
    // إذا ما في مدير موجود، نضيف مدير افتراضي
    User.findOne({ role: 'admin' }).then(admin => {
      if(!admin){
        // أنشئ مدير افتراضي باسم admin وكلمة admin123
        bcrypt.hash('admin123', 10).then(hash => {
          const adminUser = new User({ username: 'admin', passwordHash: hash, role: 'admin' });
          adminUser.save().then(() => console.log('Admin user created: admin / admin123'));
        });
      }
    });

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('MongoDB connection error:', err));
