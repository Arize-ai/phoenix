# Developer's Guide

- [Developer's Guide](#developers-guide)
  - [Setting Up Your macOS Development Environment](#setting-up-your-macos-development-environment)
  - [Running Scripts with `hatch`](#running-scripts-with-hatch)
  - [Installing Pre-Commit Hooks](#installing-pre-commit-hooks)
  - [Building the `phoenix` Package](#building-the-phoenix-package)
  - [Installing a `phoenix` Build](#installing-a-phoenix-build)
  - [Setting Up Your Windows Test Environment](#setting-up-your-windows-test-environment)
    - [Selecting a Virtualization Option](#selecting-a-virtualization-option)
    - [Installing Python and `phoenix`](#installing-python-and-phoenix)
    - [Configuring a Remote Interpreter](#configuring-a-remote-interpreter)
    - [Troubleshooting](#troubleshooting)

## Setting Up Your macOS Development Environment

This section shows you how to set up an isolated virtual environment using `pyenv` and `virtualenvwrapper`. If you are new to `pyenv`, you can install it via `brew` with
```bash
brew install pyenv
```
Next, install a `phoenix`-supported Python version, e.g., `3.10.8`, with
```bash
export PHOENIX_PYTHON_VERSION=<your-supported-python-version>
pyenv install $PHOENIX_PYTHON_VERSION
```
Set the global `pyenv` version with
```bash
pyenv global $PHOENIX_PYTHON_VERSION
```
Install `virtualenvwrapper` with
```bash
pip install virtualenvwrapper
```
Create a new virtual environment with
```bash
mkvirtualenv phoenix-env
```
Install `phoenix` in development mode (using the `-e` flag) and with development dependencies (using the `[dev]` extra) by running
```bash
pip install -e '.[dev]'
```
from the repository root.

## Running Scripts with `hatch`

`hatch` is the project management tool used to build `phoenix`. After installing and activating the `phoenix-env` virtual environment, view the project environments, dependencies and scripts defined in `pyproject.toml` with
```bash
hatch env show
```
Scripts belonging to the various environments can be run with
```bash
hatch run <env-name>:<script-name>
```
For example, you can check types with
```bash
hatch run type:check
```
You can fix styles with
```bash
hatch run style:fix
```
You can run tests with coverage with
```bash
hatch run test:coverage
```

The following resources are helpful to learn more about the capabilities of `hatch` and to familiarize yourself with the CLI.
- [Hatch Quickstart](https://hatch.pypa.io/latest/)
- [Hatch CLI Reference](https://hatch.pypa.io/latest/cli/reference/)

## Installing Pre-Commit Hooks

Install pre-commit hooks with
```bash
pre-commit install
```
Once installed, the pre-commit hooks configured in `.pre-commit-config.yaml` will automatically run prior to each `git commit`.

## Building the `phoenix` Package

To build `phoenix`, run
```bash
hatch build
```
If successful, a source distribution (a tarball) and a Python `wheel` will appear in the `dist` folder at the repo base directory.

## Installing a `phoenix` Build

We recommend using a separate virtual environment (e.g., `phoenix-test-env`) for installing and testing the builds created above.

To install `phoenix` from the source distribution (i.e., tarball), run
```bash
pip install /path/to/source/distribution/tarball.tar.gz
```

To install `phoenix` from the Python `wheel`, you must first install `wheel` with
```bash
pip install wheel
```
Then run
```bash
pip install /path/to/wheel.whl
```
(You should only install one of the source distribution or the `wheel` at a time.)

To make sure everything works, install `jupyter` with
```bash
pip install jupyter
```
and run the notebooks in the `examples` directory.

## Setting Up Your Windows Test Environment

It is occasionally necessary to manually test a `phoenix` build or to run `phoenix` from source on Windows. The following instructions enable macOS developers who do not have a PC to quickly set up a Windows Python environment in a cloud or local virtual machine.

### Selecting a Virtualization Option

We recommend to use a virtual machine either with Microsoft Azure (a cloud virtual machine) or using the Parallels Desktop app (a local virtual machine). Which option you select will depend on your hardware and whether you wish to run a remote IDE. The following resources are helpful to make a decision:

- [Parallels Desktop for Mac System Requirements](https://kb.parallels.com/en/124223)
- [Supported SSH Clients for Remote Development with VSCode](https://code.visualstudio.com/docs/remote/troubleshooting#_installing-a-supported-ssh-client)

At the time of this writing in December 2022,
- Windows 11 is the only Windows OS with a supported ARM version,
- JetBrains does not support remote development on Windows servers,
- VSCode supports remote development on certain Windows versions not including Windows 11.

Hence, if you are a macOS developer using an Apple Silicon machine and you wish to use a remote interpreter, running a Windows VM locally is not straightforward and we recommend you use a Windows VM on Azure.

If you elect to use an Azure VM, we recommend that you select a non-headless OS (we use Windows Server 2019), configure an inbound port rule for RDP on port 3389 while creating the VM and screenshare with your VM using Microsoft Remote Desktop, which can be downloaded from the Apple App Store. This will enable you to [configure an SSH server](#configuring-a-remote-interpreter) on the VM for remote development.

### Installing Python and `phoenix`

The following instructions assume you have created a Windows virtual machine either locally or in the cloud. These instructions have been tested on Windows Server 2019 and assume you are using Powershell.

Install `chocolatey`, a package manager for Windows, by following the instructions [here](https://chocolatey.org/install#individual).

Open a new shell and run
```powershell
choco install nvm pyenv-win git
```

Open a new shell and install the latest long-term supported version of `node` using
```powershell
nvm install lts
```
Activate this version using
```powershell
nvm use lts
```
Open a new shell and confirm that `node` and `npm` are available with
```powershell
node --version
npm --version
```

Install your desired Python version with
```powershell
$env:PHOENIX_PYTHON_VERSION = "desired-python-version"
pyenv install $env:PHOENIX_PYTHON_VERSION
```
Set the global `pyenv` version with
```powershell
pyenv global $env:PHOENIX_PYTHON_VERSION
```

Install `virtualenvwrapper-win` with
```powershell
pip install virtualenvwrapper-win
```
Create a virtual environment called `phoenix-env` with
```powershell
mkvirtualenv phoenix-env
```
Activate your virtual environment. You can now [install a `phoenix` build](#installing-a-phoenix-build). Alternatively, if you wish to run `phoenix` from source, clone the repo and install `phoenix` in development mode with
```powershell
pip install -e '.[dev]'
```

### Configuring a Remote Interpreter

If you wish to use a remote SSH interpreter (e.g., via VSCode), you must install and run an SSH server on your Windows VM. We recommend to install OpenSSH Server by navigating to `Settings > Apps > Manage optional features > Add a feature`, selecting `OpenSSH Server` in the list and clicking `Install`. To start the SSH server, navigate to `Control Panel > System and Security > Administrative Tools > View local services`, select `OpenSSH Server` and press `Start`. If you wish to configure the server to start automatically on startup, select `Actions > Properties` while `OpenSSH Server` is selected from the list (or just double-click on `OpenSSH Server`), select `Automatic` in the `Startup type` dropdown and hit `Apply`.

You must also ensure that port 22 of your Windows VM is reachable by your SSH client.
- If using an Azure VM, this can be accomplished by defining an appropriate inbound port rule for TCP on port 22 either during creation of the virtual machine or after creation in the VM's networking settings.
- If using Parallels Desktop, navigate to `Preferences > Network` and define a port forwarding rule for TCP on destination port 22.

### Troubleshooting

- In our experience, the `workon` command familiar to users of `virtualenvwrapper` may not properly run on Windows with `virtualenvwrapper-win`. In order to activate a virtual environment, you can manually run the appropriate activation script (`activate.ps1` if using Powershell) typically located in `$env:USERPROFILE\Envs\<env-name>\Scripts`.
