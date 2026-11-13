import{R as m,j as w}from"./react-DPpEJ79P.js";function g(e){return`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${e==="cover"?1600:1200}" viewBox="0 0 1200 ${e==="cover"?1600:1200}" role="img" aria-label="Placeholder image">
      ${e==="portrait"?`
      <rect width="1200" height="1200" rx="96" fill="#f8fafc"/>
      <rect x="72" y="72" width="1056" height="1056" rx="88" fill="#e2e8f0"/>
      <circle cx="600" cy="450" r="170" fill="#94a3b8"/>
      <path d="M290 1010c48-152 177-248 310-248s262 96 310 248" fill="#64748b"/>
      <path d="M304 986c54-122 161-198 296-198s242 76 296 198" fill="#0f766e" opacity="0.2"/>
      <text x="600" y="1035" text-anchor="middle" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#475569">Author Photo</text>`:e==="logo"?`
      <rect width="1200" height="1200" rx="120" fill="#f8fafc"/>
      <circle cx="600" cy="600" r="330" fill="#e2e8f0"/>
      <path d="M390 420h420v360H390z" fill="#0f766e" opacity="0.16"/>
      <path d="M450 490h300v52H450zm0 88h210v52H450zm0 88h260v52H450z" fill="#334155"/>
      <text x="600" y="900" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#475569">Logo</text>`:`
      <rect width="1200" height="1600" rx="88" fill="#f8fafc"/>
      <rect x="80" y="80" width="1040" height="1440" rx="72" fill="#dbeafe"/>
      <rect x="120" y="120" width="960" height="1360" rx="56" fill="#ffffff"/>
      <path d="M220 1230c96-260 224-390 380-390s284 130 380 390" fill="#0f766e" opacity="0.14"/>
      <circle cx="600" cy="500" r="140" fill="#94a3b8"/>
      <rect x="300" y="720" width="600" height="42" rx="21" fill="#334155" opacity="0.18"/>
      <rect x="260" y="790" width="680" height="34" rx="17" fill="#334155" opacity="0.12"/>
      <rect x="320" y="860" width="560" height="34" rx="17" fill="#334155" opacity="0.12"/>
      <text x="600" y="1100" text-anchor="middle" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="#0f172a">Book Cover</text>
      <text x="600" y="1168" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="600" fill="#475569">Placeholder</text>`}
    </svg>
  `)}`}const b=m.memo(function({src:f,alt:c,className:h,srcSet:r,sizes:a,fallbackVariant:x="cover",loading:s="lazy",decoding:n="async",fetchPriority:d,...p}){const o=g(x);let i=f?.trim()||o;if(i.startsWith("/uploads/")||i.startsWith("uploads/")){const t=i.replace(/^\//,"");r||(r=`/cdn/${t}?w=400&format=webp 400w, /cdn/${t}?w=800&format=webp 800w, /cdn/${t}?format=webp 1200w`,a=a||"(max-width: 600px) 400px, (max-width: 1024px) 800px, 1200px",i=`/cdn/${t}?w=800&format=webp`)}return w.jsx("img",{src:i,alt:c,className:h,...p,loading:s,decoding:n,fetchPriority:d,srcSet:r,sizes:a,onError:t=>{const l=t.currentTarget;l.dataset.fallbackApplied!=="true"&&(l.dataset.fallbackApplied="true",l.src=o,l.removeAttribute("srcset"))}})});export{b as R};
