"""Persist advisory operation analysis without changing policy decisions."""
from alembic import op
import sqlalchemy as sa

revision = "20261111_ai_analysis"
down_revision = "024dc6e5ee59"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("operations", sa.Column("ai_analysis", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("operations", "ai_analysis")
