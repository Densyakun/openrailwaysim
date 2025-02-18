# Open Railway Sim

Open Railway Sim (ORS) はオープンソースの鉄道シミュレーターです。

- Next.js アプリ

## Quick Start

1. Clone or fork `openrailwaysim`:

```sh
git clone https://github.com/Densyakun/openrailwaysim.git
```

2. Install all dependencies:

```sh
cd openrailwaysim
npm install
```

3. Run websocket server:

```sh
npm run ws
```

4. Run app:

```sh
npm run dev
```

## 列車の作成

- 運転台はOtherBodyに追加することができます。OtherBodyに運転台を複数追加したい場合や、ボギーに運転台を追加したい場合は、ボギーなどにジョイントされたOtherBodyを作成してください。

## 列車ダイヤ

- タイムゾーンはデフォルトで Asia/Tokyo になります

## その他

#### シミュレーションするもの

- 粘着式鉄道
- ラック式鉄道
- 鋼索鉄道
- 鉄輪式リニア

#### シミュレーションしないもの

- モノレール
- ゴムタイヤ、案内軌条式鉄道
- 浮上式鉄道
- 索道、ロープウェイ

### データのファイル形式と参照について

ORSでは、インターネット上にあるファイルをURLで参照します。

#### 3Dデータのファイル形式

現在、glTF（glb）のみ対応しています。

### 地形生成について

地形の生成には、次の地図タイルを使用しています:

- [国土地理院 標高タイル（基盤地図情報数値標高モデル）](https://maps.gsi.go.jp/development/ichiran.html#dem)
