from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine

import models  # noqa: F401  Base.metadataにテーブル定義を登録するため
from db import Base, database_url

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# DB URL(RDSの自動生成パスワードは"%"を含みうる)はConfigParser経由で渡すと
# 補間構文として解釈され失敗するため、config.set_main_option()は使わずdatabase_url()を直接使う。


def run_migrations_offline() -> None:
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(database_url())
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
