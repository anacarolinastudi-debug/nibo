import '@fontsource/libre-baskerville/400.css';
import '@fontsource/libre-baskerville/700.css';
import '@fontsource/montserrat/400.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/800.css';

let fontsPromise;
let backgroundPromise;
let lightLogoPromise;
export function loadContentAssets() {
  if (!fontsPromise) fontsPromise = Promise.all([
    document.fonts.load('400 40px "Libre Baskerville"', 'Gestão contábil'),
    document.fonts.load('700 82px "Libre Baskerville"', 'Gestão contábil'),
    document.fonts.load('400 34px "Montserrat"', 'Gestão contábil'),
    document.fonts.load('600 24px "Montserrat"', 'Gestão contábil'),
    document.fonts.load('800 82px "Montserrat"', 'Gestão contábil'),
  ]).catch((error) => { fontsPromise = null; throw error; });
  if (!backgroundPromise) backgroundPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { backgroundPromise = null; reject(new Error('Não foi possível carregar o fundo das artes.')); };
    image.src = `${import.meta.env.BASE_URL}content/organic-navy-v1.png`;
  });
  if (!lightLogoPromise) lightLogoPromise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { lightLogoPromise = null; reject(new Error('Não foi possível carregar a marca para fundo branco.')); };
    image.src = `${import.meta.env.BASE_URL}content/young-logo-official-v2.png`;
  });
  return Promise.all([fontsPromise, backgroundPromise, lightLogoPromise]).then(([, background, lightLogo]) => ({ background, lightLogo }));
}
