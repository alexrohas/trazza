type WordmarkProps = {
  className?: string;
};

/* Texto de verdad, no una imagen: la tipografia (Baloo 2, ver index.html) es la que hace
   que se lea como el logo. El color no se fija aqui — hereda currentColor, asi que cada
   sitio donde se usa decide si sale blanco, negro o el color del tema con una sola linea
   de CSS, sin necesitar una version "clara" y otra "oscura" del archivo. */
export function Wordmark({ className }: WordmarkProps) {
  return <span className={className ? `wordmark ${className}` : "wordmark"}>trazza</span>;
}
