# GPU Sandboxes

GPU-accelerated sandboxes and their capabilities.

GPU sandboxes are **Linux sandboxes with one or more dedicated GPUs** attached, for training, inference, and other GPU work. The GPUs of a running sandbox are its own.

GPU sandboxes run workloads that require GPU acceleration, such as model inference, training, fine-tuning, and reinforcement learning. A create request asks for a number of GPUs, and Daytona places the sandbox on a host that has enough free GPUs.

A GPU sandbox is ephemeral: deleting it discards its filesystem. Its state can be saved as a checkpoint of its processes, memory, and GPU memory, and resumed in a new GPU sandbox. The available GPU models and GPU sandbox features and limits may change over time.

| **Component**  | **Description**                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Sandbox**    | An isolated Linux machine with dedicated GPUs that runs code.                                        |
| **GPU**        | A processor built for parallel work, such as training and running machine learning models.           |
| **GPU count**  | The number of GPUs attached to one sandbox.                                                          |
| **Host**       | The physical server that runs sandboxes and holds their GPUs.                                        |
| **Image**      | A packaged filesystem that defines what software a sandbox starts with.                              |
| **GPU memory** | The memory on a GPU that holds the data the GPU works on, such as model weights.                     |
| **Checkpoint** | A saved copy of the processes and memory of a running program, from which the program resumes later. |
| **Ephemeral**  | A sandbox whose filesystem is discarded when the sandbox is deleted.                                 |
