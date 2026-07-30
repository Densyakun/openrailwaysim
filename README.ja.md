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

- パスワードが設定されている場合、クライアント接続時に認証ダイアログが表示され、ユーザー名とパスワードの入力が必要です。
- パスワードが設定されていない場合、自動的に接続されます。ユーザー名は Settings パネル（歯車アイコン）からいつでも変更できます。
- ユーザー名は32文字以内です。
- 接続中のユーザー一覧は Users パネル（Peopleアイコン）から確認できます。

### 地形生成について

地形の生成には、次の地図タイルを使用しています:

- [国土地理院 標高タイル（基盤地図情報数値標高モデル）](https://maps.gsi.go.jp/development/ichiran.html#dem)
