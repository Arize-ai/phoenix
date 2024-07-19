session
=======

.. contents:: :local:

phoenix.launch_app
------------------
.. automethod:: session.session::launch_app

phoenix.active_session
----------------------
.. automethod:: session.session::active_session

phoenix.close_app
-----------------
.. automethod:: session.session::close_app

phoenix.delete_all
------------------
.. automethod:: session.session::delete_all

phoenix.Session
---------------
A session that maintains the state of the Phoenix app. Obtain the active session as follows::

   session = px.active_session()

|

.. autoclass:: session.session::Session
   :members:
