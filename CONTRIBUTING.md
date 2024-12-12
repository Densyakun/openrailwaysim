#### プロパティを追加するとき

- Trainなどの型にデータのプロパティを追加する
- オブジェクトを初期化するときに、追加したプロパティの初期化を実装する
- `lib/game.ts` のtoSerializablePropとfromSerializablePropを追加したプロパティに対応する
- 必要であれば `lib/server.ts` の `setupServer()` にて、追加したプロパティの値が変更されたときにクライアントに同期する
  - 正しく同期されているか確認する
