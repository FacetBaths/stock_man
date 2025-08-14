const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../../data.json');

// Initialize data structure
const defaultData = {
  items: [],
  walls: [],
  toilets: [],
  bases: [],
  tubs: [],
  vanities: [],
  showerDoors: [],
  nextId: 1
};

// Ensure data file exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
}

// Read data from file
const readData = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data file:', error);
    return defaultData;
  }
};

// Write data to file
const writeData = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing data file:', error);
    return false;
  }
};

// Generate new ID
const generateId = () => {
  const data = readData();
  const id = data.nextId;
  data.nextId = id + 1;
  writeData(data);
  return id.toString();
};

// Initialize JSON database
const initJSONDB = () => {
  if (!fs.existsSync(DB_FILE)) {
    console.log('📁 Creating JSON database file...');
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
    console.log('✅ JSON database initialized');
  } else {
    console.log('📁 JSON database file found');
  }
};

module.exports = {
  readData,
  writeData,
  generateId,
  initJSONDB
};
