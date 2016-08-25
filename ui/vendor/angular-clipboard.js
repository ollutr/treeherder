/*!
 * angular-clipboard (https://github.com/omichelsen/angular-clipboard)
 * Licensed under the MIT license
 */

/* this has been modified from the upstream version to fix a bug in
   our production code pipeline (involving babel). see
   https://bugzilla.mozilla.org/show_bug.cgi?id=1298086 */

angular.module('angular-clipboard', [])
    .factory('clipboard', ['$document', function ($document) {
        function createNode(text, context) {
            var node = $document[0].createElement('textarea');
            node.style.position = 'absolute';
            node.textContent = text;
            node.style.left = '-10000px';
            if (context instanceof HTMLElement) {
                node.style.top = context.getBoundingClientRect().top + 'px';
            }
            return node;
        }

        function copyNode(node) {
            try {
                // Set inline style to override css styles
                $document[0].body.style.webkitUserSelect = 'initial';

                var selection = $document[0].getSelection();
                selection.removeAllRanges();
                node.select();

                if(!$document[0].execCommand('copy')) {
                    throw('failure copy');
                }
                selection.removeAllRanges();
            } finally {
                // Reset inline style
                $document[0].body.style.webkitUserSelect = '';
            }
        }

        function copyText(text, context) {
            var node = createNode(text, context);
            $document[0].body.appendChild(node);
            copyNode(node);
            $document[0].body.removeChild(node);
        }

        return {
            copyText: copyText,
            supported: 'queryCommandSupported' in document && document.queryCommandSupported('copy')
        };
    }])
    .directive('clipboard', ['clipboard', function (clipboard) {
        return {
            restrict: 'A',
            scope: {
                onCopied: '&',
                onError: '&',
                text: '=',
                supported: '=?'
            },
            link: function (scope, element) {
                scope.supported = clipboard.supported;

                element.on('click', function (event) {
                    try {
                        clipboard.copyText(scope.text, element[0]);
                        if (angular.isFunction(scope.onCopied)) {
                            scope.$evalAsync(scope.onCopied());
                        }
                    } catch (err) {
                        if (angular.isFunction(scope.onError)) {
                            scope.$evalAsync(scope.onError({err: err}));
                        }
                    }
                });
            }
        };
    }]);
