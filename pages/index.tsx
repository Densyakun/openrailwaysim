import dynamic from 'next/dynamic'
import Head from 'next/head'

const Container = dynamic(() => import('@/components/Container'), {
  ssr: false,
})

export default function Home() {
  return (
    <>
      <Head>
        <title>Open Railway Sim</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Container />
    </>
  )
}
