from allauth.socialaccount.providers.oauth2.client import OAuth2Client


class CompatOAuth2Client(OAuth2Client):
    """
    Compatibility wrapper for dj-rest-auth + allauth oauth client arg changes.

    dj-rest-auth passes a `scope` positional argument. Newer allauth versions can
    fail with:
    "OAuth2Client.__init__() got multiple values for argument 'scope_delimiter'".
    """

    def __init__(
        self,
        request,
        consumer_key,
        consumer_secret,
        access_token_method,
        access_token_url,
        callback_url,
        scope=None,
        scope_delimiter=" ",
        headers=None,
        basic_auth=False,
    ):
        try:
            super().__init__(
                request,
                consumer_key,
                consumer_secret,
                access_token_method,
                access_token_url,
                callback_url,
                scope,
                scope_delimiter=scope_delimiter,
                headers=headers,
                basic_auth=basic_auth,
            )
        except TypeError as exc:
            if "scope_delimiter" not in str(exc):
                raise
            super().__init__(
                request,
                consumer_key,
                consumer_secret,
                access_token_method,
                access_token_url,
                callback_url,
                scope_delimiter=scope_delimiter,
                headers=headers,
                basic_auth=basic_auth,
            )
            if scope is not None:
                setattr(self, "scope", scope)
