const { MongoClient, ObjectId } = require('mongodb');

const DEFAULT_URI = 'mongodb://localhost:27017';
const DEFAULT_DB_NAME = 'aiblog';

let client;
let db;

async function initDb() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  const dbName = process.env.MONGODB_DB || DEFAULT_DB_NAME;

  client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db(dbName);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDb() first.');
  }
  return db;
}

function getCollection(name) {
  return getDb().collection(name);
}

async function closeDb() {
  if (client) {
    await client.close();
    client = undefined;
    db = undefined;
  }
}

module.exports = {
  initDb,
  getDb,
  getCollection,
  closeDb,
  ObjectId,
};
