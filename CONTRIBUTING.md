#### プロパティ、データを追加して、セーブデータの構造を変更する

Track, Train などのデータは `lib/game.ts` の `store.data` で管理しています。

例えば、 Track に含まれる THREE.Vector3 は関数を含みます。
このような非 Serializable なデータは、マルチプレイの同期、セーブデータへのシリアル化が必要です。
すべてのデータのシリアル化は `lib/game.ts` の `serialize` と `deserialize` 関数に記述しています。

`serialize` 及び `deserialize` 関数は、第1引数に型を表す文字列 (TypeId) 、第2引数にデータとなるオブジェクトを入力して処理します。
TypeId をオブジェクトのパスから求める `getTypeIdByPath` 関数もあります。
非 Serializable なデータを含む、全ての祖先のデータは、シリアル化の処理を記述する必要があります。

必要であれば `lib/server.ts` のgetTypeIdByPathを追加したデータに対応させます。
必要であれば `lib/server.ts` の `setupServer()` にて、追加したプロパティの値が変更されたときにクライアントに同期し、正しく同期されているか確認してください。

また、セーブデータでは異なるデータ構造になっているデータがあります。
ストアとセーブデータの変換処理は `save.ts` にあります。
