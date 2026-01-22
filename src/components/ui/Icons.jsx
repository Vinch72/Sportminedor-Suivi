// src/components/ui/Icons.jsx
export function IconEdit(props){
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           className="w-4 h-4" {...props}>
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
      </svg>
    );
  }
  export function IconTrash(props){
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           className="w-4 h-4" {...props}>
        <path d="M3 6h18"/>
        <path d="M8 6v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
      </svg>
    );
  }  

// 💳 CB
export function IconCard(props){
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           className="w-4 h-4" {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <line x1="2" y1="10" x2="22" y2="10"></line>
      </svg>
    );
  }
  // 💶 Espèces (billets)
  export function IconCash(props){
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           className="w-4 h-4" {...props}>
        <rect x="3" y="6" width="18" height="12" rx="2"></rect>
        <circle cx="12" cy="12" r="2.5"></circle>
        <path d="M7 8h.01M17 16h.01M17 8h.01M7 16h.01"></path>
      </svg>
    );
  }
  // 🧾 Chèque
  export function IconCheque(props){
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           className="w-4 h-4" {...props}>
        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
        <path d="M6 12h12M6 16h8"></path>
        <path d="M6 8l2 2 3-3"></path>
      </svg>
    );
  }
  // 🔁 Virement
  export function IconTransfer(props){
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
           className="w-4 h-4" {...props}>
        <path d="M17 6H7l2-2M7 18h10l-2 2"></path>
        <path d="M3 12h18"></path>
      </svg>
    );
  }

 // Raquette — minimaliste (un seul tracé, look moderne)
export function IconRacquetMinimal({ size=16, className="" }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        className={className} aria-hidden="true">
        <path d="M7.2 12.5a6 6 0 1 1 8.5-8.5 6 6 0 0 1-8.5 8.5Zm7.8-.1 4.9 4.9c.6.6.6 1.6 0 2.2l-.3.3c-.6.6-1.6.6-2.2 0l-4.9-4.9"/>
      </svg>
    );
  }

  export function IconRacket({ className = "w-5 h-5" }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {/* tête (ellipse) */}
        <ellipse cx="9.5" cy="8" rx="4.5" ry="5.5"></ellipse>
        {/* maillage simple */}
        <path d="M6.7 6.2l5.6 3.6M6.7 9.8l5.6-3.6M9.5 3v10"></path>
        {/* manche */}
        <path d="M13.2 11.8l6.2 6.2"></path>
        <rect x="18.6" y="16.9" width="3.2" height="5.2" rx="1.2" transform="rotate(45 18.6 16.9)"></rect>
      </svg>
    );
  }
  
  export function IconEuro({ className = "w-5 h-5" }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M19 7.5c-.9-1.4-2.6-2.5-5-2.5-3.7 0-6 2.6-6 6s2.3 6 6 6c2.4 0 4.1-1.1 5-2.5"></path>
        <path d="M4 10h8M4 14h8"></path>
      </svg>
    );
  }
  
  export function IconChat({ className = "w-5 h-5" }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M20 14a4 4 0 0 1-4 4H9l-5 4v-4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path>
        <path d="M7.5 8.5h7M7.5 12h5"></path>
      </svg>
    );
  }
  
  export function IconReturn({ className = "w-5 h-5" }) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 13H14a5 5 0 0 0 0-10H9"></path>
        <path d="M6 9l-4 4 4 4"></path>
      </svg>
    );
  }
  
  