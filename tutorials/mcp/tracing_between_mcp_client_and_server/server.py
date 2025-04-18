"""
FastMCP Financial Analysis Server
"""

import json
import os
from datetime import datetime, timedelta

import openai
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from openinference.instrumentation.mcp import MCPInstrumentor
from openinference.instrumentation.openai import OpenAIInstrumentor
from openinference.semconv.trace import SpanAttributes
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk import trace as trace_sdk
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.trace import Status, StatusCode
from pydantic import BaseModel

load_dotenv()

# Configure OpenTelemetry
otlp_endpoint = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006")
span_exporter = OTLPSpanExporter(f"{otlp_endpoint}/v1/traces")
tracer_provider = trace_sdk.TracerProvider()
span_processor = SimpleSpanProcessor(span_exporter)
tracer_provider.add_span_processor(span_processor)
# Get a tracer
tracer = tracer_provider.get_tracer("financial-analysis-server")

# Instrument MCP with OpenInference
MCPInstrumentor().instrument(tracer_provider=tracer_provider)
OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)

# Configure OpenAI client
client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL = "gpt-4-turbo"

# Create server
mcp = FastMCP("Financial Analysis Server")


class StockAnalysisRequest(BaseModel):
    ticker: str
    time_period: str = "short-term"  # short-term, medium-term, long-term


@mcp.tool()
def analyze_stock(request: StockAnalysisRequest) -> dict:
    """Analyzes a stock based on its ticker symbol and provides investment recommendations."""
    with tracer.start_as_current_span("MCP.analyze_stock") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "tool")
        span.set_attribute(
            SpanAttributes.INPUT_VALUE,
            str({"ticker": request.ticker, "time_period": request.time_period}),
        )

        # Make LLM API call to analyze the stock
        prompt = f"""
        Provide a detailed financial analysis for the stock ticker: {request.ticker}
        Time horizon: {request.time_period}

        Please include:
        1. Company overview
        2. Recent financial performance
        3. Key metrics (P/E ratio, market cap, etc.)
        4. Risk assessment
        5. Investment recommendation

        Format your response as a JSON object with the following structure:
        {{
            "ticker": "{request.ticker}",
            "company_name": "Full company name",
            "overview": "Brief company description",
            "financial_performance": "Analysis of recent performance",
            "key_metrics": {{
                "market_cap": "Value in billions",
                "pe_ratio": "Current P/E ratio",
                "dividend_yield": "Current yield percentage",
                "52_week_high": "Value",
                "52_week_low": "Value"
            }},
            "risk_assessment": "Analysis of risks",
            "recommendation": "Buy/Hold/Sell recommendation with explanation",
            "time_horizon": "{request.time_period}"
        }}
        """

        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        analysis = json.loads(response.choices[0].message.content)

        span.set_attribute(
            SpanAttributes.OUTPUT_VALUE, str({"recommendation": analysis["recommendation"]})
        )
        span.set_status(Status(StatusCode.OK))
        return analysis


class PortfolioOptimizationRequest(BaseModel):
    stocks: list
    risk_tolerance: str = "moderate"  # conservative, moderate, aggressive
    investment_horizon: str = "medium"  # short, medium, long


@mcp.tool()
def optimize_portfolio(request: PortfolioOptimizationRequest) -> dict:
    """Optimizes a portfolio based on stocks, risk tolerance, and investment horizon."""
    with tracer.start_as_current_span("MCP.optimize_portfolio") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "tool")
        span.set_attribute(
            SpanAttributes.INPUT_VALUE,
            str(
                {
                    "stocks": request.stocks,
                    "risk_tolerance": request.risk_tolerance,
                    "investment_horizon": request.investment_horizon,
                }
            ),
        )

        prompt = f"""
        Optimize a portfolio with the following stocks: {', '.join(request.stocks)}
        Risk tolerance: {request.risk_tolerance}
        Investment horizon: {request.investment_horizon}

        Please provide:
        1. Recommended allocation percentages for each stock
        2. Expected return and risk assessment
        3. Diversification analysis
        4. Rebalancing recommendations

        Format your response as a JSON object with the following structure:
        {{
            "portfolio_allocation": [
                {{"ticker": "TICKER1", "allocation_percentage": XX.X}},
                {{"ticker": "TICKER2", "allocation_percentage": XX.X}},
                ...
            ],
            "expected_annual_return": "X.X%",
            "risk_level": "Description of portfolio risk level",
            "diversification_analysis": "Analysis of sector/geographic diversification",
            "rebalancing_recommendation": "How often to rebalance",
            "risk_tolerance": "{request.risk_tolerance}",
            "investment_horizon": "{request.investment_horizon}"
        }}
        """

        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        optimization = json.loads(response.choices[0].message.content)

        span.set_attribute(
            SpanAttributes.OUTPUT_VALUE,
            str({"expected_return": optimization["expected_annual_return"]}),
        )
        span.set_status(Status(StatusCode.OK))
        return optimization


@mcp.tool()
def forecast_market_trends(sector: str, timeframe: int = 6) -> dict:
    """Forecasts market trends for a specific sector over the given timeframe (in months)."""
    with tracer.start_as_current_span("MCP.forecast_market_trends") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "tool")
        span.set_attribute(
            SpanAttributes.INPUT_VALUE, str({"sector": sector, "timeframe": timeframe})
        )

        end_date = (datetime.now() + timedelta(days=30 * timeframe)).strftime("%B %Y")

        prompt = f"""
        Forecast market trends for the {sector} sector over the next {timeframe} months
        (until {end_date}).

        Please provide:
        1. Overall sector outlook
        2. Key drivers and catalysts
        3. Potential risks and challenges
        4. Top performing subsectors or companies
        5. Investment implications

        Format your response as a JSON object with the following structure:
        {{
            "sector": "{sector}",
            "timeframe": "{timeframe} months (until {end_date})",
            "overall_outlook": "Bullish/Neutral/Bearish with explanation",
            "key_drivers": ["driver 1", "driver 2", "driver 3"],
            "potential_risks": ["risk 1", "risk 2", "risk 3"],
            "top_performers": ["subsector/company 1", "subsector/company 2", "subsector/company 3"],
            "investment_implications": "Strategic investment advice based on forecast"
        }}
        """

        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        forecast = json.loads(response.choices[0].message.content)

        span.set_attribute(
            SpanAttributes.OUTPUT_VALUE, str({"outlook": forecast["overall_outlook"]})
        )
        span.set_status(Status(StatusCode.OK))
        return forecast


@mcp.tool()
def analyze_economic_indicator(indicator: str, country: str = "United States") -> dict:
    """Analyzes an economic indicator and its impact on financial markets."""
    with tracer.start_as_current_span("MCP.analyze_economic_indicator") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "tool")
        span.set_attribute(
            SpanAttributes.INPUT_VALUE, str({"indicator": indicator, "country": country})
        )

        prompt = f"""
        Analyze the economic indicator "{indicator}" for {country} and its impact on
        financial markets.

        Please provide:
        1. Description of the indicator
        2. Current status and recent trends
        3. Impact on different asset classes (stocks, bonds, commodities, etc.)
        4. Forecast for the next 6-12 months
        5. Investment implications

        Format your response as a JSON object with the following structure:
        {{
            "indicator": "{indicator}",
            "country": "{country}",
            "description": "What this indicator measures",
            "current_status": "Current value and recent trend",
            "impact": {{
                "stocks": "Impact description",
                "bonds": "Impact description",
                "commodities": "Impact description",
                "currencies": "Impact description"
            }},
            "forecast": "Forecast for next 6-12 months",
            "investment_implications": "How investors should position based on this indicator"
        }}
        """

        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        analysis = json.loads(response.choices[0].message.content)

        span.set_attribute(SpanAttributes.OUTPUT_VALUE, str({"forecast": analysis["forecast"]}))
        span.set_status(Status(StatusCode.OK))
        return analysis


@mcp.tool()
def generate_investment_report(client_profile: dict, market_analysis: dict) -> dict:
    """Generates a comprehensive investment report based on client profile and market analysis."""
    with tracer.start_as_current_span("MCP.generate_investment_report") as span:
        span.set_attribute(SpanAttributes.OPENINFERENCE_SPAN_KIND, "tool")
        span.set_attribute(
            SpanAttributes.INPUT_VALUE,
            str(
                {
                    "client_profile_keys": list(client_profile.keys()),
                    "market_analysis_keys": list(market_analysis.keys()),
                }
            ),
        )

        prompt = f"""
        Generate a comprehensive investment report for a client with the following profile:
        {json.dumps(client_profile, indent=2)}

        Based on this market analysis:
        {json.dumps(market_analysis, indent=2)}

        The report should include:
        1. Executive summary
        2. Client financial situation overview
        3. Market outlook
        4. Asset allocation recommendation
        5. Specific investment recommendations
        6. Risk management strategy
        7. Implementation timeline

        Format your response as a JSON object with the following structure:
        {{
            "report_title": "Investment Strategy Report for [Client Name]",
            "executive_summary": "Summary text",
            "client_overview": "Overview of client situation",
            "market_outlook": "Summary of market conditions",
            "asset_allocation": {{
                "equities": "XX%",
                "fixed_income": "XX%",
                "alternatives": "XX%",
                "cash": "XX%"
            }},
            "investment_recommendations": [
                {{
                    "asset_class": "class",
                    "recommendation": "specific recommendation",
                    "rationale": "explanation"
                }}
            ],
            "risk_management": "Risk management strategy",
            "implementation_timeline": "Timeline for implementing recommendations",
            "timestamp": "current timestamp"
        }}
        """

        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )

        report = json.loads(response.choices[0].message.content)
        report["timestamp"] = datetime.now().isoformat()

        span.set_attribute(
            SpanAttributes.OUTPUT_VALUE, str({"report_sections": list(report.keys())})
        )
        span.set_status(Status(StatusCode.OK))
        return report


if __name__ == "__main__":
    mcp.run()
