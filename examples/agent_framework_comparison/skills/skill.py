class Skill:
    def __init__(self, name, function_dict, function_callable):
        self.name = name
        self.function_dict = function_dict
        self.function_callable = function_callable

    def get_function_name(self):
        return self.name

    def get_function_dict(self):
        return self.function_dict

    def get_function_callable(self):
        return self.function_callable
