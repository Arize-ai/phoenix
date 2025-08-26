# Can I run Phoenix on Sagemaker?

With SageMaker notebooks, phoenix leverages the [jupyter-server-proy](https://github.com/jupyterhub/jupyter-server-proxy) to host the server under `proxy/6006.`Note, that phoenix will automatically try to detect that you are running in SageMaker but you can declare the notebook runtime via a parameter to `launch_app` or an environment variable

```python
import os

os.environ["PHOENIX_NOTEBOOK_ENV"] = "sagemaker"
```
