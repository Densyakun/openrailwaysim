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

5. 起動時にログイン画面が表示されます。接続先の WebSocket サーバー URL とパスワードを入力して「サーバーに接続」を押してください。

WebSocket サーバーを使わずに試す場合は、`npm run dev:local` で起動するか、ログイン画面で「ローカルモードで開始」を押します。

## 列車の作成

- 運転台はOtherBodyに追加することができます。OtherBodyに運転台を複数追加したい場合や、ボギーに運転台を追加したい場合は、ボギーなどにジョイントされたOtherBodyを作成してください。
- Standard Modeでは両端の車両に運転台が追加されます。

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

### 接続パスワードとユーザー名

WebSocket サーバーには、環境変数でパスワードを設定できます。

```sh
# 接続にパスワードを要求する
CONNECTION_PASSWORD=mypassword npm run ws

# 管理パスワード（現在は予約済み、後で使用予定）
ADMIN_PASSWORD=adminpass npm run ws

# 両方設定
CONNECTION_PASSWORD=mypassword ADMIN_PASSWORD=adminpass npm run ws
```

環境変数を `.env` ファイルに記述することもできます（プロジェクトルートに配置）：

```
CONNECTION_PASSWORD=mypassword
ADMIN_PASSWORD=adminpass
```

- パスワードが設定されている場合、起動時のログイン画面でパスワードを入力します。
- パスワードが設定されていない場合、サーバーに接続すると自動的に認証されます。ユーザー名はログイン画面または Settings パネル（歯車アイコン）から変更できます。
- ユーザー名は32文字以内です。
- 接続中のユーザー一覧は Users パネル（Peopleアイコン）から確認できます。

### 接続先サーバーの指定

起動時のログイン画面、または Settings パネルの「Server URL」から、接続するWebSocketサーバーを変更できます。

- 空欄の場合は、ページを配信しているホストの `ws://<ホスト名>:8080/ws` に接続します。
- URLを確定（Enterまたはフォーカスアウト）すると再接続します。
- 入力したURLはブラウザの localStorage に保存され、次回アクセス時も使用されます。

### ローカルモード

WebSocket サーバーを起動せずに、ブラウザ内のローカルサーバーで動作確認できます。

- `npm run dev:local` で起動する
- 通常の `npm run dev` で起動し、ログイン画面で「ローカルモードで開始」を押す
- URL に `?local` を付けた場合もローカルモードで起動する
- セーブデータはブラウザの localStorage に保存されます

### 地形生成について

地形の生成には、次の地図タイルを使用しています:

- [国土地理院 標高タイル（基盤地図情報数値標高モデル）](https://maps.gsi.go.jp/development/ichiran.html#dem)
