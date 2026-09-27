<?php
use Drupal\Core\DrupalKernel;
use Symfony\Component\HttpFoundation\Request;
chdir(__DIR__);
$autoloader = require 'autoload.php';
$request = Request::create('/');
$kernel = DrupalKernel::createFromRequest($request, $autoloader, 'prod');
$kernel->boot();
$kernel->preHandle($request);
\Drupal::service('module_installer')->install(['contact', 'search']);
user_role_grant_permissions('anonymous', [
  'access site-wide contact form', 'search content', 'access content',
  'administer site configuration', 'access administration pages', 'view the administration theme',
  'administer blocks', 'administer account settings', 'administer users',
]);
\Drupal::configFactory()->getEditable('user.settings')->set('register', 'visitors')->save();
drupal_flush_all_caches();
$ids = \Drupal::entityQuery("contact_form")->accessCheck(FALSE)->execute(); echo implode(",", $ids), "\n";
echo "ok\n";
