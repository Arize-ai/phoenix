# A collection of printing and logging utilities

def printif(condition: bool, *args, **kwargs):
    if condition:
        print(*args, **kwargs)
