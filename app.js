require('dotenv').config();
const express = require('express');
const path = require('path');
const { initDb, getDb } = require('./lib/db');
const postRoutes = require('./routes/postRoutes');
const aiRoutes = require('./routes/aiRoutes');
const imageRoutes = require('./routes/imageRoutes');
const seoRoutes = require('./routes/seoRoutes');
const grammarRoutes = require('./routes/grammarRoutes');
const apiPostRoutes = require('./routes/apiPostRoutes');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', postRoutes); 
app.use('/api/ai', aiRoutes);
app.use('/api', imageRoutes);
app.use('/api/seo', seoRoutes);
app.use('/api/grammar', grammarRoutes);
app.use('/api/posts', apiPostRoutes);

app.use((req, res, next) => {
  const error = new Error('Not Found');
  error.status = 404;
  next(error);
});

app.use((error, req, res, next) => {

  const status = error.status || 500;

  console.error('Error:', error.message);
  
  res.status(status);
  res.render('error', { 
    title: `Error ${status}`,
    message: error.message,
    error: req.app.get('env') === 'development' ? error : {}
  }); 
});

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.locals.db = getDb();
    app.listen(PORT, () => {
      console.log(`Server is running on http:
    });
  })
  .catch((error) => {
    console.error('Failed to initialize database connection:', error);
    process.exit(1);
  });
