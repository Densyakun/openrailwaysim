import Head from 'next/head'
import Canvas from '@/components/Canvas'

export default function Home() {
  return (
    <>
      <Head>
        <title>Open Railways Sim</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Canvas />
    </>
  )
}
