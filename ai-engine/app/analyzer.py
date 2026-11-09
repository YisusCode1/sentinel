from analyzer.schemas import (
    OperationAnalysisRequest,
    RiskAnalysisResponse,
)
from analyzer.service import analyze_operation_async


async def analyze_risk(
    request: OperationAnalysisRequest,
) -> RiskAnalysisResponse:
    """
    Ejecuta el análisis de riesgo mediante Gemini.

    El resultado es únicamente informativo.
    Nunca autoriza ni ejecuta transacciones.
    """

    return await analyze_operation_async(request)
