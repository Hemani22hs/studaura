document.addEventListener('DOMContentLoaded', () => {
     const cards = [
         {
             q: "Question: What is Spaced Repetition?",
             a: "Answer: An evidence-based learning technique that reviews information at increasing intervals."
             },
             { 
                q: "Question: What is the Active Recall technique?",
                a: "Answer: Testing yourself during study sessions rather than passively re-reading notes."
             }, 
             { 
                q: "Question: How long is a standard Pomodoro cycle?",
                a: "Answer: 25 minutes of focused work followed by a 5-minute break."
             } 
            ]; 
            let currentIndex = 0; 
            let isFlipped = false; 
            
            const flashcardBox = document.getElementById('flashcard'); 
            const cardText = document.getElementById('card-text'); 
            const cardIndex = document.getElementById('card-index'); 
            const prevBtn = document.getElementById('prev-btn'); 
            const nextBtn = document.getElementById('next-btn'); 
            
            function updateCardDisplay() 
            {
                if (!cardText || !cardIndex) return; 
                cardText.textContent = isFlipped ? cards[currentIndex].a : cards[currentIndex].q; 
                cardIndex.textContent = `Card ${currentIndex + 1} of ${cards.length}`;
            }
            
            function flipCard() { 
                isFlipped = !isFlipped; 
                updateCardDisplay(); 
            } 
            
            function nextCard() 
            { 
                currentIndex = (currentIndex + 1) % cards.length; isFlipped = false; 
                updateCardDisplay(); 
            } 
                
            function prevCard() 
            { 
                currentIndex = (currentIndex - 1 + cards.length) % cards.length; 
                isFlipped = false; 
                updateCardDisplay();
            } 
                
            if (flashcardBox) flashcardBox.addEventListener('click', flipCard); 
            if (nextBtn) nextBtn.addEventListener('click', nextCard); 
            if (prevBtn) prevBtn.addEventListener('click', prevCard); 
            
            document.addEventListener('keydown', (e) =>  
            { 
                if (e.code === 'Space') 
                { 
                    e.preventDefault(); 
                    flipCard(); 
                } else if (e.code === 'ArrowRight') { 
                    nextCard(); 
                } else if (e.code === 'ArrowLeft') { 
                    prevCard(); 
                } 
            }); 
            
            const faqQuestions = document.querySelectorAll('.faq-question');    
                       
            faqQuestions.forEach((question) => { 
                question.addEventListener('click', () => { 
                    const parentItem = question.parentElement; 
                    const isActive = parentItem.classList.contains('active'); 
                    
                    document.querySelectorAll('.faq-item').forEach((item) => { 
                        item.classList.remove('active'); 
                        const indicator = item.querySelector('.faq-toggle-symbol'); 
                        if (indicator) indicator.textContent = '+'; 
                    }); 
                    
                    if (!isActive) { 
                        parentItem.classList.add('active'); 
                        const indicator = question.querySelector('.faq-toggle-symbol'); 
                        if (indicator) indicator.textContent = '-'; 
                    } 
                }); 
            }); 
            
            document.querySelectorAll('a[href^="#"]').forEach((anchor) => 
            { 
                anchor.addEventListener('click', function (e) 
                { 
                    const targetId = this.getAttribute('href'); 
                    if (targetId === '#') return; 
                    const targetElement = document.querySelector(targetId); 
                    if (targetElement) 
                    { 
                        e.preventDefault(); 
                        targetElement.scrollIntoView({ 
                            behavior: 'smooth'
                         }); 
                    } 
                }); 
        }); 
});