# 検討: dev環境のdestroyと再apply運用

- ステータス: 完了
- 区分: **必須と任意が混在**（secretのライフサイクルは再apply可否を左右する必須事項。削除猶予日数や監視方法は後から変更できる任意事項）
- 開始日: 2026-08-23
- 最終更新: 2026-08-23
- 関連: [Issue #111](https://github.com/study-basic-hackathon/hanasu/issues/111)、[`infra/dev/README.md`](../../infra/dev/README.md)、[`infra/dev/secrets.tf`](../../infra/dev/secrets.tf)、[`infra/bootstrap/README.md`](../../infra/bootstrap/README.md)、[ADR-0013](../ADR/0013-ドキュメントの役割と正本の所在.md)

## 背景・きっかけ

dev環境は費用削減や再検証のため、Terraformの`destroy`と`apply`を繰り返す可能性がある。Issue #111の実環境検証では、固定名のJWT用Secrets Manager secretが過去のdestroyにより削除予約中となっており、直後のapplyが同名secretを再作成できず部分失敗した。

今回は削除予約を取り消す`RestoreSecret`と、既存AWSリソースをTerraform stateへ関連付ける`terraform import`で復旧した。ただし、毎回手動復旧する運用は再現性が低いため、destroy後に安全かつ予測可能に再applyできる方式を検討する。

## 論点

- **必須**: JWT secretをdev環境のdestroyと一緒に破棄するか、環境より長く保持するか。
- **必須**: destroy直後の再applyを待ち時間なしで成立させる必要があるか。
- **必須**: secret名を固定する外部要件またはTerraform外の参照者が存在するか。
- **必須**: secretを別stateへ分離する場合、stateの保存先・権限・destroy責任をどこに置くか。
- **任意**: Secrets Managerの削除猶予日数を何日にするか。
- **任意**: 削除予約中secretやdestroy失敗をどの手順で検知・記録するか。

## 事実確認（出典付き）

- 最新mainのJWT secretは`name = "${local.name_prefix}-jwt-secret-key"`という固定名で、`random_password`、Secrets Manager secret、secret versionを同じ`infra/dev` stateで管理する。出典: [`infra/dev/secrets.tf`](../../infra/dev/secrets.tf)。
- ECS task definitionは固定名ではなくsecret ARNを参照しているため、現行Terraform内ではsecret名そのものを実行時設定として使っていない。出典: [`infra/dev/locals.tf`](../../infra/dev/locals.tf)。
- 最新mainのリポジトリ内検索では、AWS secretの固定名`hanasu-dev-jwt-secret-key`をTerraform外から参照するコード・スクリプトは見つからなかった。backendは`JWT_SECRET_KEY`環境変数だけを読み、AWS環境ではTerraformがsecret ARNをECSへ渡す。`docker-compose.yml`の`JWT_SECRET_KEY`はローカル開発用の直接値であり、AWS secret名・ARNへの参照ではない。出典: [`backend/app/security.py`](../../backend/app/security.py)、[`docker-compose.yml`](../../docker-compose.yml)、[`infra/dev/locals.tf`](../../infra/dev/locals.tf)。
- `infra/dev`のdestroy手順はstate内の全リソースを破棄する。state保存用S3 bucketは別stateであり、`infra/dev`のdestroy対象外である。出典: [`infra/dev/README.md`](../../infra/dev/README.md)、[`infra/bootstrap/README.md`](../../infra/bootstrap/README.md)。
- AWS Secrets Managerは通常、secretを即時削除せず、最低7日の回復期間を設けて削除予約にする。削除予約中はsecretへアクセスできる状態ではないが、回復期間中は復旧でき、削除予約中のsecretには料金が発生しない。出典: [AWS: Delete an AWS Secrets Manager secret](https://docs.aws.amazon.com/secretsmanager/latest/userguide/manage_delete-secret.html)。
- `RestoreSecret`は`DeletedDate`を除去して削除予約を取り消す。出典: [AWS: RestoreSecret API](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_RestoreSecret.html)。
- AWSによる完全削除は回復期間終了後の非同期処理であり、完了時刻は保証されない。したがって、回復期間を0日にしても固定名を直ちに再利用できる保証にはならない。出典: [AWS Secrets Manager API Reference](https://docs.aws.amazon.com/secretsmanager/latest/apireference/secretsmanager-apireference.pdf)。
- Terraformの`prevent_destroy = true`は削除planを拒否するため、同じstateに置いたままでは通常の`terraform destroy`を完走できない。出典: [Terraform lifecycle reference](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle#prevent_destroy)。
- 2026-08-23の実測では、削除予約中の固定名secretによりapplyが失敗し、旧ECS task definitionの登録解除まで反映された部分失敗になった。restore、import、再plan、再apply後は最新mainに対して`No changes`となった。出典: [Issue #111の実行記録](https://github.com/study-basic-hackathon/hanasu/issues/111#issuecomment-5383864213)。
- `infra/bootstrap`のstateはローカル保存であるため、JWT値を持つresourceをそのままbootstrapへ移すと、機微値を含むstateがローカルに残る。永続resourceを分離する場合も、暗号化・アクセス制御されたremote stateを別途使う必要がある。出典: [`infra/bootstrap/README.md`](../../infra/bootstrap/README.md)。

## 選択肢の比較

| 観点 | A案: devごとに一意なsecret名 | B案: secretを永続stateへ分離 | C案: 固定名のrestore/import運用 |
|---|---|---|---|
| 概要 | `name_prefix`などでapplyごとに一意な名前を作る | secretをdev本体と別のremote stateで管理し、dev側はARNを参照する | 現行コードを維持し、衝突時にrestoreとimportを行う |
| destroy直後の再apply | 成立しやすい。旧secretが削除予約中でも別名を作れる | 成立する。devのdestroyでsecretを削除しない | そのままでは失敗。手動復旧が必要 |
| secretの継続性 | destroyごとに新しい値・ARNになる | 維持できる | restoreできる間は維持できるが、完全削除後は新規になる |
| state構成 | 現行の単一stateを維持 | stateと権限・適用順が増える | 現行の単一stateを維持 |
| 手動作業 | 原則不要 | 初期構築と参照関係の運用が必要 | destroy/applyのたびに発生し得る |
| 固定名 | 保持しない | 保持可能 | 保持する |
| 削除待ちsecret | 回復期間中は一覧に残るが課金なし | 通常発生しない | 発生し、再applyを阻害する |
| 誤削除耐性 | dev全体と同じ | state分離により高い | 手順依存 |
| 向く前提 | 短命なdev環境、即時再作成重視、外部の固定名参照なし | 値の継続性が必要、環境より長寿命、複数環境から共有 | destroy頻度が低く、一時的な手動運用を許容 |

### 補助案としては採用しにくいもの

- `recovery_window_in_days = 0`: 完全削除は非同期であり、固定名の即時再利用を保証しない。復旧不能にもなるため、反復運用の主対策にはしない。
- 同一stateで`prevent_destroy = true`: secretは守れるが`terraform destroy`全体が失敗する。部分destroyやstate操作を通常手順に持ち込むため、現行の一括destroy方針と合わない。
- 毎回コード上のsecret名を変更: 再applyはできるが、手作業・レビュー漏れ・不要な差分を生むため自動的な一意名より劣る。

## 懸念

- A案では、Terraform外で固定名を検索している運用や監視があると参照切れになる。現時点のリポジトリ内参照はARN経由だが、AWSコンソール運用や外部スクリプトは未確認。
- A案ではsecret ARNが再applyごとに変わるため、Terraform外にARNを保存する場合は更新手順が必要になる。
- B案ではstate間依存が増える。remote state参照を使う場合は、state全体を読める権限が機微情報へのアクセスにつながる点を考慮する必要がある。
- B案で`infra/bootstrap`のローカルstateへsecretを追加してはいけない。機微値を保持する独立remote stateが必要になる。
- どの案でも、JWT secret valueを`random_password`と`aws_secretsmanager_secret_version.secret_string`で管理する限り、値はTerraform stateに保存される。S3 stateの暗号化とアクセス制御は引き続き必須。
- destroyの途中失敗は、今回のように一部resourceだけ削除・更新された状態を残す。destroy/applyともに終了後planとstate lock確認を標準手順に含める必要がある。

## お客様・関係者と詰めるべき事項

| 確認相手 | 確認内容 | 回答が決定にどう効くか |
|---|---|---|
| ユーザー／チーム | destroyから再applyまで待ち時間なしを必須とするか | 必須ならC案を除外する |
| バックエンド担当 | JWT署名鍵をdestroy後も維持する必要があるか | 必要ならB案、不要ならA案が有力になる |
| 運用担当 | Terraform外でsecret名またはARNを参照する処理があるか | 固定参照があればA案の影響調査が必要になる |
| セキュリティ担当 | JWT署名鍵のローテーション周期と失効影響 | A案のdestroy時ローテーションを許容できるか判断する |

## 議論ログ

- 2026-08-23: Issue #111の最新main applyで、固定名JWT secretが削除予約中だったためCreateSecretが失敗。ECS task definitionの置換途中で部分失敗した。
- 2026-08-23: ユーザーの明示許可を受け、RestoreSecretとterraform importで既存secretをstateへ戻し、再plan後にapplyした。最新mainに対する再planは`No changes`。
- 2026-08-23: ユーザーから、今後もdestroyとapplyを繰り返す可能性があるため運用方式を議論したいとの依頼を受領。A案（一意名）、B案（永続state分離）、C案（restore/import手順）を初期候補として整理した。
- 2026-08-23: ユーザーは、開発の一区切りまで残り約1週間はC案の現行運用を維持し、その後はA案を有力候補とする意向を表明。dev環境destroy時に既存JWT tokenが無効になっても再ログインで対応可能、再applyの待ち時間は必須要件ではないが数日は不可で数時間まで、と回答した。
- 2026-08-23: 最新mainを検索し、Terraform外からAWS secretの固定名・ARNを参照するリポジトリ内実装は見つからないことを確認。AWS外の手動運用、CI設定、個人スクリプトの有無は引き続き確認対象とした。
- 2026-08-23: ユーザーは、現時点でTerraform外の固定参照がなくても将来追加されないとは言い切れないため、開発の一区切り後はB案（secretを永続stateへ分離）を採用する方針を選択した。

## 結論

次を決定した。

1. 開発の一区切りまで残り約1週間は、現行の固定名とC案（必要時のrestore/import）を維持する。
2. その後はB案を採用し、JWT secretをdev環境本体より長寿命な別のremote stateで管理する。通常の`infra/dev` destroyではJWT secretを削除しない。
3. B案の永続stateは、local stateを使う`infra/bootstrap`へ同居させない。暗号化・アクセス制御されたremote stateを使用する。
4. dev環境destroy時のJWT token失効自体は許容されるが、将来Terraform外の固定名・ARN参照が追加される可能性を考慮し、secretの識別子を安定させる方を優先する。
5. destroy直後の即時再applyは必須ではないが、数日待つ運用は採用しない。B案によりSecrets Managerの削除猶予期間に依存しない再applyを可能にする。

決め手は、将来の外部参照可能性に対して固定名・ARNを維持できること、通常のdev destroyとsecretのライフサイクルを分離できること、restore/importを反復運用の通常手順にしなくてよいことである。

A案は現在のリポジトリ構成だけなら単純で有効だが、将来固定名・ARN参照が追加された場合にdestroy後の参照切れを招くため見送った。C案は残り約1週間の暫定運用として維持するが、手作業と部分失敗リスクがあるため長期運用には採用しない。

次アクションは別タスクで扱う。

- 永続stateのディレクトリ、S3 backend key、適用権限、通常destroyの責任境界を設計する。
- dev側がsecretを参照する方法（AWS data sourceで固定名を検索するか、remote state outputを読むか）を決める。
- 現在のdev stateから実リソースを削除せず管理対象だけを切り離し、永続stateへimportする移行planを作る。
- 永続state側の誤destroy防止、JWTローテーション、障害時runbookを定める。
- 決定内容をADRまたは運用仕様へ昇格し、実装Issueを作成する。
