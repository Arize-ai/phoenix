import pandas as pd
from phoenix.core.model_schema import FEATURE, PREDICTION_ID, TAG, Schema


def test_role_precedence():
    pred_id = "pred_id"
    schema = Schema(prediction_id=pred_id, features=[pred_id])
    model = schema(pd.DataFrame())
    assert model[PREDICTION_ID].name == pred_id
    assert len(list(model[FEATURE])) == 0
    schema = Schema(features=[pred_id], tags=[pred_id])
    model = schema(pd.DataFrame())
    assert len(list(model[FEATURE])) == 1
    assert next(model[FEATURE]).name == pred_id
    assert len(list(model[TAG])) == 0
