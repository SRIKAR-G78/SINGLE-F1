const fs = require('fs');
const s = fs.readFileSync('server.js','utf8');
const counts = {
  '{': (s.match(/{/g) || []).length,
  '}': (s.match(/}/g) || []).length,
  '(': (s.match(/\(/g) || []).length,
  ')': (s.match(/\)/g) || []).length,
  '[': (s.match(/\[/g) || []).length,
  ']': (s.match(/\]/g) || []).length,
  '`': (s.match(/`/g) || []).length,
  "'": (s.match(/'/g) || []).length,
  '"': (s.match(/"/g) || []).length
};
console.log(counts);
