##############################################################################
#                                                                            #
#  Copyright 2006-2019 WebPKI.org (http://webpki.org).                       #
#                                                                            #
#  Licensed under the Apache License, Version 2.0 (the "License");           #
#  you may not use this file except in compliance with the License.          #
#  You may obtain a copy of the License at                                   #
#                                                                            #
#      https://www.apache.org/licenses/LICENSE-2.0                           #
#                                                                            #
#  Unless required by applicable law or agreed to in writing, software       #
#  distributed under the License is distributed on an "AS IS" BASIS,         #
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  #
#  See the License for the specific language governing permissions and       #
#  limitations under the License.                                            #
#                                                                            #
##############################################################################

##################################################################
# Convert a Python double/float into an ES6/V8 compatible string #
##################################################################

def convert2Es6Format(value):
    """Convert double/float to str using the native Python formatter"""

    fvalue = float(value)

    # Zero is a special case.  The following line takes "-0" case as well
    if fvalue == 0:
        return '0'

    # The rest of the algorithm works on the textual representation only
    pyDouble = str(fvalue)

    # The following line catches the "inf" and "nan" values returned by str(fvalue)
    if 'n' in pyDouble:
        raise ValueError("Invalid JSON number: " + pyDouble)

    # Save sign separately, it doesn't have any role in the algorithm
    pySign = ''
    if pyDouble[0] == '-':
        pySign = '-'
        pyDouble = pyDouble[1:]

    # Now we should only have valid non-zero values
    pyExpStr = ''
    pyExpVal = 0
    q = pyDouble.find('e')
    if q > 0:
        # Grab the exponent and remove it from the number
        pyExpStr = pyDouble[q:]
        if pyExpStr[2:3] == '0':
            # Suppress leading zero on exponents
            pyExpStr = pyExpStr[:2] + pyExpStr[3:]
        pyDouble = pyDouble[0:q]
        pyExpVal = int(pyExpStr[1:])

    # Split number in pyFirst + pyDot + pyLast
    pyFirst = pyDouble
    pyDot = ''
    pyLast = ''
    q = pyDouble.find('.')
    if q > 0:
        pyDot = '.'
        pyFirst = pyDouble[:q]
        pyLast = pyDouble[q + 1:]

    # Now the string is split into: pySign + pyFirst + pyDot + pyLast + pyExpStr
    if pyLast == '0':
        # Always remove trailing .0
        pyDot = ''
        pyLast = ''

    if pyExpVal > 0 and pyExpVal < 21:
        # Integers are shown as is with up to 21 digits
        pyFirst += pyLast
        pyLast = ''
        pyDot = ''
        pyExpStr = ''
        q = pyExpVal - len(pyFirst)
        while q >= 0:
            q -= 1;
            pyFirst += '0'
    elif pyExpVal < 0 and pyExpVal > -7:
        # Small numbers are shown as 0.etc with e-6 as lower limit
        pyLast = pyFirst + pyLast
        pyFirst = '0'
        pyDot = '.'
        pyExpStr = ''
        q = pyExpVal
        while q < -1:
            q += 1;
            pyLast = '0' + pyLast

    # The resulting sub-strings are concatenated
    return pySign + pyFirst + pyDot + pyLast + pyExpStr
