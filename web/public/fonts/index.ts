import localFont from 'next/font/local';

export const apercu = localFont({
  src: [
    {
      path: './apercu-pro/apercu_regular_pro.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './apercu-pro/apercu_regular_italic_pro.otf',
      weight: '400',
      style: 'italic',
    },
    {
      path: './apercu-pro/apercu_medium_pro.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: './apercu-pro/apercu_medium_italic_pro.otf',
      weight: '500',
      style: 'italic',
    },
    {
      path: './apercu-pro/apercu_bold_pro.otf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './apercu-pro/apercu_bold_italic_pro.otf',
      weight: '700',
      style: 'italic',
    },
  ],
  variable: '--font-apercu',
  display: 'swap',
});

export const lato = localFont({
  src: [
    {
      path: './lato/Lato-Thin.ttf',
      weight: '100',
      style: 'normal',
    },
    {
      path: './lato/Lato-ThinItalic.ttf',
      weight: '100',
      style: 'italic',
    },
    {
      path: './lato/Lato-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: './lato/Lato-LightItalic.ttf',
      weight: '300',
      style: 'italic',
    },
    {
      path: './lato/Lato-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: './lato/Lato-Italic.ttf',
      weight: '400',
      style: 'italic',
    },
    {
      path: './lato/Lato-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: './lato/Lato-BoldItalic.ttf',
      weight: '700',
      style: 'italic',
    },
    {
      path: './lato/Lato-Black.ttf',
      weight: '900',
      style: 'normal',
    },
    {
      path: './lato/Lato-BlackItalic.ttf',
      weight: '900',
      style: 'italic',
    },
  ],
  variable: '--font-lato',
  display: 'swap',
});