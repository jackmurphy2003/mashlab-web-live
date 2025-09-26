import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="MashLab - DJ Mashup Laboratory" />
        <meta name="theme-color" content="#0C1022" />
        <link rel="icon" href="/favicon.ico" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__API_BASE__ = '${process.env.NEXT_PUBLIC_API_URL ?? ''}';`
          }}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
