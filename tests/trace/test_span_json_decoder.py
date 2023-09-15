from phoenix.trace.span_json_decoder import json_to_span


def test_span_json_decoder_document_retrieval():
    span = json_to_span(
        {
            "name": "retrieve",
            "context": {
                "trace_id": "9241913b-eadf-4891-9e17-24686ccc3ed3",
                "span_id": "89ff67d5-1818-41b7-ab09-17bcc450491c",
            },
            "span_kind": "RETRIEVER",
            "parent_id": "d493e9ab-321f-41ac-a1b2-60d80c50b2cb",
            "start_time": "2023-09-15T14:04:07.167267",
            "end_time": "2023-09-15T14:04:07.812851",
            "status_code": "OK",
            "status_message": "",
            "attributes": {
                "input.value": "How do I use the SDK to upload a ranking model?",
                "input.mime_type": "text/plain",
                "retrieval.documents": [
                    {
                        "document.id": "883e74ee-691a-46e0-acd7-f58bd565dad4",
                        "document.score": 0.8024018669959406,
                        "document.content": """\nRanking models are used by
                                            search engines to display query
                                            results ranked in the order of the
                                            highest relevance. These predictions
                                            seek to maximize user actions that
                                            are then used to evaluate model
                                            performance.&#x20;\n\nThe complexity
                                            within a ranking model makes
                                            failures challenging to pinpoint as
                                            a model\u2019s dimensions expand per
                                            recommendation. Notable challenges
                                            within ranking models include
                                            upstream data quality issues,
                                            poor-performing segments, the cold
                                            start problem, and more.
                                            &#x20;\n\n\n\n""",
                        "document.metadata": "{}",
                    },
                    {
                        "document.id": "d169f0ce-b5ea-4e88-9653-f8bb2fb1d105",
                        "document.score": 0.7964861566463088,
                        "document.content": """\n**Use the
                                            'arize-demo-hotel-ranking' model,
                                            available in all free accounts, to
                                            follow along.**&#x20;\n\n""",
                        "document.metadata": "{}",
                    },
                ],
            },
            "events": [],
            "conversation": None,
        }
    )
    assert span.name == "retrieve"
    assert len(span.attributes["retrieval.documents"]) == 2
