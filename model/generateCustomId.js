function generateUniqueShortId() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomLetters = '';
  const randomLetterLength = 3;
  for (let i = 0; i < randomLetterLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomLetters += characters.charAt(randomIndex);
  }

  const randomLetter = characters.charAt(Math.floor(Math.random() * characters.length));
  const randomNumber = Math.floor(Math.random() * 10);

  const now = new Date();
  const year = now.getFullYear().toString().slice(-1); // Using last digit of the year
  const month = ('0' + (now.getMonth() + 1)).slice(-1); // Using last digit of the month
  const day = ('0' + now.getDate()).slice(-2);
  const minutes = ('0' + now.getMinutes()).slice(-1); // Using last digit of the minutes
  const seconds = ('0' + now.getSeconds()).slice(-1); // Using last digit of the seconds

  // Generate a random string with a larger character set and length
  let randomString = '';
  const randomLength = 5;
  for (let i = 0; i < randomLength; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  const uniqueShortId = `${randomLetters}${year}${month}${day}${randomLetter}${randomNumber}${minutes}${seconds}${randomString}`;

  return uniqueShortId;
}


  module.exports=generateUniqueShortId