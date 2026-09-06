---
id: 20260822-133931-issue87-deployment-governance
scope: project
created_at: 2026-08-22T13:39:31+09:00
work_unit: "#87 Amplify Hosting の IaC 管理範囲とデプロイ方式の決定"
repository: hanasu
source: "Issue #87, PR #95"
---

# 振り返り: #87 のデプロイ方式決定

## L-01: 共有ワークツリーの ADR 採番は未追跡ファイルも確認する

- 状態: 未反映
- 型: 環境・手順発見
- 事象: main 上の最大番号だけを確認して ADR-0015 を作成したところ、並行作業の未追跡 ADR-0015 と衝突した。ADR-0016 へ振り直し、Issue の参照も更新した。
- 学び: 共有ワークツリーで ADR を新設する前は、main の既存 ADR に加え、ローカルの未追跡・未コミット ADR と進行中 PR の採番も確認する必要がある。
- 介入案: ADR を新設する作業手順に、`documents/ADR/` の worktree 状態と GitHub の進行中 PR を確認する工程を追加する。
- 反映先候補: ADR 作成を扱うプロジェクトの作業手順またはスキル。
- 解決記録: なし

## L-02: CloudFront 前段化では ALB の既定ルールと security group まで確認する

- 状態: 反映済み
- 型: 知識ギャップ
- 事象: CloudFront origin header の listener rule を追加する案では、既存 ALB の default action が forward、security group が `0.0.0.0/0:80` であるため、ALB 直接アクセスを防げなかった。
- 学び: CloudFront→ALB の到達制限は origin custom header だけでは不十分であり、header 一致 rule、default fixed 403、CloudFront managed prefix list による inbound 制限を組み合わせる。
- 介入案: CloudFront / ALB の実装 Issue に三層の到達制限を完了条件として明記する。
- 反映先候補: ADR-0016、Issue #92。
- 解決記録: 2026-08-22 に ADR-0016 と #92 の完了条件へ反映済み。PR #95 に記録し、ユーザーがマージした。
