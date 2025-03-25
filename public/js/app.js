function updateProgress(remainingPercent) {
    const circle = document.querySelector('.progress-ring-fill');
    const radius = 140;
    const circumference = 2 * Math.PI * radius;
    
    const offset = (remainingPercent / 100) * circumference;
    circle.style.strokeDashoffset = circumference - offset;
  
    document.querySelector('.progress-text').innerText = remainingPercent + "%";
  }
  
  // Example: Set progress to 50%
  updateProgress(10);


  

  