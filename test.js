const urls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtube.com/embed/dQw4w9WgXcQ',
  'https://www.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ',
  'https://youtube.com/shorts/dQw4w9WgXcQ?feature=share',
  'https://youtube.com/watch?v=xyz12345678'
];

const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?.*v=|shorts\/))([\w-]{11})/i;

urls.forEach(url => {
  const match = url.match(regex);
  console.log(url, '=>', match ? match[1] : null);
});
