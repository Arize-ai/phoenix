import os
import sys
from typing import Callable

sys.path.insert(1, os.path.join(sys.path[0], ".."))

from skills.analyze_data import AnalyzeData
from skills.generate_sql_query import GenerateSQLQuery


class SkillMap:
    """
    This class is used to map the skills to their function names and function callables.
    This is an additional layer of abstraction on top of the skills themselves. The intent here is
    to separate the skills from the agents and their routers. This allows us to easily add new
    skills and use them in different agents and routers.
    """

    def __init__(self):
        # To add more skills, create a new class that inherits from Skill
        # and add it to the list here
        skills = [AnalyzeData(), GenerateSQLQuery()]

        self.skill_map = {}
        for skill in skills:
            self.skill_map[skill.get_function_name()] = (
                skill.get_function_dict(),
                skill.get_function_callable(),
            )

    def get_function_callable_by_name(self, skill_name) -> Callable:
        return self.skill_map[skill_name][1]

    def get_combined_function_description_for_openai(self):
        combined_dict = []
        for _, (function_dict, _) in self.skill_map.items():
            combined_dict.append(function_dict)
        return combined_dict

    def get_function_list(self):
        return list(self.skill_map.keys())

    def get_list_of_function_callables(self):
        return [skill[1] for skill in self.skill_map.values()]

    def get_function_description_by_name(self, skill_name):
        return str(self.skill_map[skill_name][0]["function"])
