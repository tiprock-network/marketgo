function generateString() {
    const randomLetters = generateRandomLetters(3);
    const dateComponent = generateDateComponent();
    const timeComponent = generateTimeComponent();
    
    return `utr-${randomLetters}${dateComponent}${timeComponent}`;
  }
  
  function generateRandomLetters(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
  
    return result;
  }
  
  function generateDateComponent() {
    const now = new Date();
    const year = now.getFullYear().toString().substr(-2);
    const month = ('0' + (now.getMonth() + 1)).slice(-2);
    const day = ('0' + now.getDate()).slice(-2);
  
    return `${day}${month}${year}`;
  }
  
  function generateTimeComponent() {
    const now = new Date();
    const hours = ('0' + now.getHours()).slice(-2);
    const minutes = ('0' + now.getMinutes()).slice(-2);
    const seconds = ('0' + now.getSeconds()).slice(-2);
  
    return `${hours}${minutes}${seconds}`;
  }

  module.exports=generateString