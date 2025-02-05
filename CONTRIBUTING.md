#### セーブデータの構造を変更するとき（プロパティを追加するときなど）

- セーブデータの構造を変更する（例えば、Trainなどの型にデータのプロパティを追加する）
  - プロパティの場合、オブジェクトを初期化するときに、追加したプロパティの初期化を実装する
- 必要であれば `lib/game.ts` のtoSerializableSaveDataとfromSerializableSaveDataを追加したデータに対応する
- 必要であれば `lib/server.ts` のgetTypeIdByPathを追加したデータに対応する
- 必要であれば `lib/server.ts` の `setupServer()` にて、追加したプロパティの値が変更されたときにクライアントに同期する
  - 正しく同期されているか確認する
