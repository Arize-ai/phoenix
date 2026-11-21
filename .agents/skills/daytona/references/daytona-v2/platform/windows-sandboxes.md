# Windows Sandboxes

Windows virtual machine sandboxes and their capabilities.

Windows sandboxes are **Windows virtual machines (VMs)**. Each sandbox runs its own Windows operating system on shared physical hardware and has its own files, network connection, and a fixed amount of processor, memory, and disk. The hypervisor enforces the boundary and the isolation between sandboxes and the host machine.

A Windows sandbox starts from a prepared Windows base image or from an image captured from another Windows sandbox. The base image stays read-only, and each sandbox writes its changes to its own disk. A persistent Windows sandbox keeps its disk across stop and start.

While the sandbox is running, it exposes a toolbox for command and process execution, sessions, filesystem and git operations, and computer use. Commands run in PowerShell, and the desktop is reached over the remote desktop protocol. The features and limits of Windows sandboxes can differ from those of Linux sandboxes and may change over time.

| **Component**      | **Description**                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| **Sandbox**        | An isolated Windows machine created on demand to run code.                                                     |
| **Host**           | The physical server that runs many sandboxes at once.                                                          |
| **Guest**          | The Windows operating system running inside a sandbox, as opposed to the operating system of the host.         |
| **Hypervisor**     | Software on the host that creates virtual machines and keeps them separated from each other and from the host. |
| **Base image**     | A prepared Windows disk that a sandbox starts from. Sandboxes do not write to it.                              |
| **Captured image** | A saved copy of a Windows sandbox's disk that new sandboxes start from.                                        |
| **Persistent**     | A sandbox that keeps its disk across stop and start.                                                           |
| **PowerShell**     | The Windows shell that runs commands and sessions inside the sandbox.                                          |
| **Remote desktop** | Access to the Windows desktop of the sandbox over the remote desktop protocol (RDP).                           |
